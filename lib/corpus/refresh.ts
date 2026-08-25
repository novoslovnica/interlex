import { prismaCorpus, prismaData } from "@/lib/prisma"
import { buildCollocationRecords, createDbAnalyzer } from "@/lib/corpus/tokenizer/analyzer-factory"
import { CollocationMatcher } from "@/lib/corpus/tokenizer/collocationMatcher"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"
import { lexemeVariants } from "@/lib/corpus/tokenizer/lexemeVariants"
import { generateWordForms } from "@/lib/grammar/morphology/engine"
import { isValidPos } from "@/lib/grammar/common"
import { reanalyzeCorpusSentences } from "@/lib/corpus/reanalyzeDocument"
import { generateCorpusCandidateProposals, reconcileProposals } from "@/lib/corpus/candidates/generateProposals"
import { normalizeSurfaceForm } from "@/lib/corpus/candidates/reconstruct"

// Отметка времени последнего точечного обновления. Живёт там же, где уже
// лежат отметки пересчёта частотности и CEFR (corpus_config —
// key/value-таблица в corpus.db).
const WATERMARK_KEY = "analysis_last_refreshed"

// Сколько строк отдавать в один IN: у SQLite есть предел на число параметров.
const IN_CHUNK = 400

export interface RefreshResult {
  /** Первый запуск: отметка выставлена, пересчёт не делался. */
  baselineEstablished?: boolean
  changedLexemes: number
  affectedTokens: number
  affectedSentences: number
  reanalyzed: number
  stillUnrecognized: number
  closedClusters: number
  newClusters: number
  watermark: Date
}

async function readWatermark(): Promise<Date | null> {
  const row = await prismaCorpus.corpusConfig.findUnique({ where: { key: WATERMARK_KEY } })
  if (!row) return null
  const parsed = new Date(row.value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Двигает отметку времени цикла. Публичная, потому что вызывать её надо
 * ПОСЛЕ пересчёта частотности, а он живёт в CLI-обёртке.
 *
 * Почему это важно: computeLexiconFrequencies обновляет corpusFrequency и
 * cefrLevel у ВСЕХ лексем через Prisma, а значит сдвигает им @updatedAt.
 * Цикл ищет изменения по updatedAt — поэтому отметка, записанная до
 * пересчёта, гарантирует, что следующий запуск увидит изменившимся весь
 * словарь и выродится в полный пересчёт. Каждый прогон отравлял бы
 * следующий; поймано на первой же боевой выкладке.
 *
 * Частотность на морфологический разбор не влияет (она участвует лишь в
 * ранжировании омонимов, и сама выводится из корпуса — гоняться за этим
 * значило бы искать неподвижную точку), поэтому такие изменения намеренно
 * не отслеживаются.
 */
export async function commitAnalysisWatermark(at: Date): Promise<void> {
  await writeWatermark(at)
}

async function writeWatermark(at: Date): Promise<void> {
  await prismaCorpus.corpusConfig.upsert({
    where: { key: WATERMARK_KEY },
    create: { key: WATERMARK_KEY, value: at.toISOString() },
    update: { value: at.toISOString() },
  })
}

/**
 * Все написания, под которыми словоформы лексемы могут встретиться в тексте:
 * то, что порождает движок, плюс свёрнутый (бездиакритический) вариант того
 * же — в корпусе слово сплошь и рядом написано упрощённо. Сопоставление в
 * БД идёт по точному равенству, поэтому оба варианта нужны явно.
 */
function surfaceCandidatesFor(lexeme: {
  id: number
  slug: string
  value: string | null
  pos: string | null
  protoStemClass: string | null
  stemExtension: string | null
  paradigm: string | null
  stem: string | null
  gender: string | null
  animacy: string | null
  isCollocation: boolean | null
}): string[] {
  if (!lexeme.value || !lexeme.pos || !isValidPos(lexeme.pos.toUpperCase())) return []
  const out = new Set<string>()
  for (const variant of lexemeVariants(lexeme.value, lexeme.stem)) {
    let forms
    try {
      forms = generateWordForms({
        id: lexeme.id,
        slug: lexeme.slug,
        isv: variant.value,
        pos: lexeme.pos.toUpperCase(),
        protoStemClass: lexeme.protoStemClass,
        stemExtension: lexeme.stemExtension,
        paradigm: lexeme.paradigm,
        stem: variant.stem,
        gender: lexeme.gender,
        animacy: lexeme.animacy,
        alternationType: null,
        fleetingVowelAt: null,
        flavor: "CORE",
        isCollocation: lexeme.isCollocation ?? false,
      }, true)
    } catch {
      continue
    }
    for (const f of forms) {
      const lowered = f.surfaceForm.toLowerCase()
      if (!lowered) continue
      out.add(lowered)
      out.add(foldDiacritics(lowered))
    }
  }
  return [...out]
}

/**
 * Замкнутый цикл «завели слово -> корпус это увидел».
 *
 * Полный пересчёт корпуса идёт 3,5 часа, поэтому крутить его после каждой
 * партии одобрений нельзя. Но разбор токена зависит только от его
 * словоформы, а значит новая лексема может изменить лишь те токены, чьи
 * формы она порождает: на живых данных это тысячи токенов, а не пять
 * миллионов.
 *
 * Порядок шагов важен: сначала переразметка (иначе сверка будет считать
 * распознанным то, что ещё не пересчитано), затем закрытие устаревших
 * предложений, и только потом генерация новых.
 *
 * Полный прогон (scripts/db/2026-07-28-reanalyze-all-documents.ts) остаётся
 * для правок самого движка — там меняется разбор ВСЕХ слов, а не только тех,
 * что связаны с изменившимися лексемами.
 */
export async function refreshCorpusForChangedLexemes(options: {
  /** Считать изменения начиная с этого момента вместо отметки в corpus_config. */
  since?: Date
  /** Не двигать отметку времени (для пробных прогонов). */
  dryWatermark?: boolean
  /**
   * Не двигать отметку здесь — вызывающая сторона сделает это сама через
   * commitAnalysisWatermark, после пересчёта частотности. См. её комментарий.
   */
  deferWatermark?: boolean
  /** Только выставить отметку и выйти: корпус уже соответствует словарю. */
  baselineOnly?: boolean
  log?: (message: string) => void
} = {}): Promise<RefreshResult> {
  const log = options.log ?? (() => {})
  const startedAt = new Date()
  const since = options.since ?? (await readWatermark())

  // Отсутствие отметки времени — это НЕ «пересчитать всё». Без этой развилки
  // первый же запуск отбирает все 24 440 лексем, набирает 2,3 млн токенов в
  // 241 тысяче предложений и вырождается в полный пересчёт, только медленным
  // путём (поймано на первом сквозном прогоне: 41 минута и падение).
  // Первый запуск просто выставляет точку отсчёта; осознанный широкий
  // пересчёт задаётся явным --since.
  if (options.baselineOnly) {
    log("Только точка отсчёта: корпус уже соответствует словарю, пересчитывать нечего.")
    if (!options.dryWatermark) await writeWatermark(startedAt)
    return {
      baselineEstablished: true,
      changedLexemes: 0, affectedTokens: 0, affectedSentences: 0, reanalyzed: 0,
      stillUnrecognized: 0, closedClusters: 0, newClusters: 0, watermark: startedAt,
    }
  }

  if (!since) {
    log("Отметки времени нет — выставляю точку отсчёта, ничего не пересчитываю.")
    log("Для намеренно широкого пересчёта укажите --since=<дата>.")
    if (!options.dryWatermark) await writeWatermark(startedAt)
    return {
      baselineEstablished: true,
      changedLexemes: 0, affectedTokens: 0, affectedSentences: 0, reanalyzed: 0,
      stillUnrecognized: 0, closedClusters: 0, newClusters: 0, watermark: startedAt,
    }
  }

  const changed = await prismaData.lexeme.findMany({
    where: { updatedAt: { gt: since } },
    select: {
      id: true, slug: true, value: true, pos: true, protoStemClass: true,
      stemExtension: true, paradigm: true, stem: true, gender: true,
      animacy: true, isCollocation: true,
    },
  })
  log(`Изменившихся лексем с ${since ? since.toISOString() : "начала времён"}: ${changed.length}`)

  const surfaces = new Set<string>()
  for (const lexeme of changed) {
    for (const form of surfaceCandidatesFor(lexeme)) surfaces.add(form)
  }
  log(`Написаний, под которыми они могут встретиться: ${surfaces.size}`)

  const surfaceList = [...surfaces]
  const sentenceIds = new Set<string>()
  let affectedTokens = 0
  for (let i = 0; i < surfaceList.length; i += IN_CHUNK) {
    const rows = await prismaCorpus.corpusToken.findMany({
      where: { surfaceForm: { in: surfaceList.slice(i, i + IN_CHUNK) }, wordIndex: { not: -1 } },
      select: { sentenceId: true },
    })
    affectedTokens += rows.length
    for (const r of rows) sentenceIds.add(r.sentenceId)
  }
  log(`Затронуто токенов: ${affectedTokens}, предложений: ${sentenceIds.size}`)

  // При большом охвате документный путь выгоднее: он читает и пишет
  // документ целиком, без выборки предложений по идентификаторам, и
  // единственный учитывает флейворное смещение по документу.
  const totalSentences = await prismaCorpus.corpusSentence.count()
  if (totalSentences > 0 && sentenceIds.size > totalSentences * 0.2) {
    log(`ВНИМАНИЕ: затронуто ${((sentenceIds.size / totalSentences) * 100).toFixed(0)}% предложений корпуса.`)
    log("При таком охвате быстрее и точнее полный прогон: scripts/db/2026-07-28-reanalyze-all-documents.ts")
  }

  let reanalyzed = 0
  let stillUnrecognized = 0
  if (sentenceIds.size > 0) {
    const analyzer = await createDbAnalyzer()
    const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())
    const result = await reanalyzeCorpusSentences([...sentenceIds], analyzer, collocationMatcher)
    reanalyzed = result.analyzed
    stillUnrecognized = result.failed
    log(`Переразмечено: ${reanalyzed}, осталось нераспознанными: ${stillUnrecognized}`)
  }

  const reconciled = await reconcileProposals()
  log(`Закрыто кластеров как распознанные: ${reconciled.closedClusters}`)

  // Генерируем только по тем словам, что затронуты этой правкой: остальные
  // 186 тысяч кластеров не изменились.
  const touchedClusterKeys = [...new Set(surfaceList.map(normalizeSurfaceForm).filter(Boolean))]
  // Генератор при каждом вызове поднимает все красные и жёлтые токены, чтобы
  // построить кластеры, — при пустом списке это чистая трата минуты.
  const generated = touchedClusterKeys.length > 0
    ? await generateCorpusCandidateProposals({ clusterKeys: touchedClusterKeys })
    : { clustersProcessed: 0 }
  log(`Пересобрано предложений по ${generated.clustersProcessed} кластерам`)

  if (!options.dryWatermark && !options.deferWatermark) await writeWatermark(startedAt)

  return {
    changedLexemes: changed.length,
    affectedTokens,
    affectedSentences: sentenceIds.size,
    reanalyzed,
    stillUnrecognized,
    closedClusters: reconciled.closedClusters,
    newClusters: generated.clustersProcessed,
    watermark: startedAt,
  }
}
