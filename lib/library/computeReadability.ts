import { DbAnalyzer } from "@/lib/corpus/tokenizer/dbAnalyzer"
import { createDbAnalyzer } from "@/lib/corpus/tokenizer/analyzer-factory"
import { TOKEN_PATTERN } from "@/lib/corpus/tokenizer/tokenizer"
import { prismaData } from "@/lib/prisma"

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
const WORD_TEST = /\p{L}/u

// Ниже какого покрытия (доля токенов текста, распознанных до лексемы с
// известным cefrLevel) оценке нет смысла доверять - слишком много текста
// осталось неразмеченным, средний балл по оставшимся не репрезентативен.
const MIN_COVERAGE = 0.3

export interface ReadabilityResult {
    score: number | null
    level: string | null
    coverage: number
}

// Один DbAnalyzer на процесс - та же экономия, что и в bulk-скриптах
// корпуса (см. AGENTS.md "Corpus Candidate Proposals"): построение индексов
// (validEndings/knownPrepositions/inflectionAnomalies) стоит один раз
// просканировать весь словарь, не на каждый вызов computeReadability.
let cachedAnalyzer: DbAnalyzer | null = null
async function getAnalyzer(): Promise<DbAnalyzer> {
    if (cachedAnalyzer) return cachedAnalyzer
    cachedAnalyzer = await createDbAnalyzer()
    return cachedAnalyzer
}

// Оценка читабельности текста библиотеки (roadmap п.42): токенизирует
// сырой текст тем же регэкспом, что и корпус-токенайзер (TOKEN_PATTERN,
// не отдельный самодельный regex - см. предупреждение в AGENTS.md "Corpus
// Crawlers" про ручные character-class regex), резолвит каждое слово через
// DbAnalyzer (тот же механизм, что и разметка корпуса - переиспользует его,
// а не приблизительное совпадение по голой словарной форме, которое
// пропустило бы почти все словоизменённые формы в сильно флективном ISV),
// и усредняет cefrLevel найденных лексем. Дорого (одна БД-выборка на
// уникальное слово) - вызывать из батч-скрипта/админ-действия, не на
// каждый рендер страницы, см. scripts/db/backfill-library-readability.ts.
export async function computeReadability(rawText: string): Promise<ReadabilityResult> {
    const tokens = rawText.match(TOKEN_PATTERN) ?? []
    const wordTokens = tokens.filter(t => WORD_TEST.test(t))
    if (wordTokens.length === 0) return { score: null, level: null, coverage: 0 }

    const analyzer = await getAnalyzer()

    // Кэш по уникальному токену на вызов - в реальном тексте функциональные
    // слова (союзы, предлоги, местоимения) повторяются десятки раз, каждый
    // повтор своим DbAnalyzer.analyzeWord() означал бы повторный поход в БД.
    const analysisCache = new Map<string, string | null>()
    const slugCounts = new Map<string, number>()

    for (const token of wordTokens) {
        let slug = analysisCache.get(token)
        if (slug === undefined) {
            const analysis = await analyzer.analyzeWord(token)
            slug = analysis?.wordSlug ?? null
            analysisCache.set(token, slug)
        }
        if (slug) {
            slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1)
        }
    }

    const slugs = [...slugCounts.keys()]
    const lexemes = slugs.length > 0
        ? await prismaData.lexeme.findMany({ where: { slug: { in: slugs } }, select: { slug: true, cefrLevel: true } })
        : []
    const cefrBySlug = new Map(lexemes.map(l => [l.slug, l.cefrLevel]))

    let weightedSum = 0
    let cefrWeight = 0
    for (const [slug, count] of slugCounts) {
        const cefr = cefrBySlug.get(slug)
        const idx = cefr ? CEFR_ORDER.indexOf(cefr) : -1
        if (idx >= 0) {
            weightedSum += (idx + 1) * count
            cefrWeight += count
        }
    }

    const coverage = cefrWeight / wordTokens.length
    if (cefrWeight === 0 || coverage < MIN_COVERAGE) {
        return { score: null, level: null, coverage }
    }

    const score = weightedSum / cefrWeight
    const level = CEFR_ORDER[Math.min(CEFR_ORDER.length - 1, Math.max(0, Math.round(score) - 1))]
    return { score, level, coverage }
}
