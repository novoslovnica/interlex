import { NextRequest, NextResponse } from "next/server"
import { execFileSync } from "child_process"
import * as path from "path"
import * as fs from "fs"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { init } from "@/lib/sqlite"
import { fetchTranslationsForLexeme, TranslationRow } from "@/lib/translations"
import { EnrichedEntry, computeEntryData, applySynsetsAndLinks, applyRelationsScoped } from "@/lib/ruwordnet/applyEntry"
import { findFuzzyLemmaCandidates } from "@/lib/ruwordnet/fuzzyMatch"

const PYTHON_DIR = path.resolve(process.cwd(), "scripts", "python")
const VENV_PYTHON = path.join(PYTHON_DIR, ".venv", "bin", "python")

/**
 * Живое сопоставление ОДНОГО слова с RuWordNet — вызывает уже существующую
 * (проверенную батчем) логику process_words.py в режиме --single-word через
 * subprocess (Python уже используется в проде для других скриптов, см. план
 * unified-herding-lightning.md). Пишет через applyRelationsScoped —
 * скоуп-ограниченный DELETE+INSERT только по meaningId этого слова, не трогая
 * auto-связи остальных слов и никогда не трогая source='manual'.
 *
 * Если у слова несколько значений (meanings) с русским переводом —
 * обрабатывает каждое отдельно (как и батч make-json-for-python.ts, который
 * тоже строит один entry на пару meaningId+перевод).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.RuwordnetMatch))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { id } = await params
  const wordId = parseInt(id, 10)
  if (isNaN(wordId)) {
    return NextResponse.json({ error: "Invalid word id" }, { status: 400 })
  }

  if (!fs.existsSync(VENV_PYTHON)) {
    return NextResponse.json({ error: "Python venv не найден на сервере (scripts/python/.venv)" }, { status: 500 })
  }

  const db = await init()
  const lexeme = db.prepare("SELECT id, value FROM lexemes WHERE id = ?").get(wordId) as { id: number; value: string } | undefined
  if (!lexeme) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 })
  }

  const grouped = fetchTranslationsForLexeme(db, wordId)
  const ruTranslations = (grouped["ru"] ?? []).filter(
    (t): t is TranslationRow & { meaningId: number; value: string } => t.meaningId !== null && !!t.value
  )
  if (ruTranslations.length === 0) {
    return NextResponse.json(
      { error: "У слова нет русского перевода — сопоставление с RuWordNet требует его" },
      { status: 400 },
    )
  }

  // "ru" был отдельной таблицей до консолидации 18 языковых таблиц в единую
  // translations (2026-07-23) — см. тот же фикс в scripts/db/upload-ruwordnet.ts.
  const ruLookup = new Map<string, number>()
  for (const row of db
    .prepare(`SELECT value, meaningId FROM translations WHERE language = 'ru' AND value IS NOT NULL AND meaningId IS NOT NULL`)
    .all() as { value: string; meaningId: number }[]) {
    ruLookup.set(row.value, row.meaningId)
  }

  const results: { meaningId: number; translation: string; synsetsMatched: number; relationsInserted: number; fuzzyCandidates: string[] }[] = []

  for (const t of ruTranslations) {
    const input = JSON.stringify({
      meaningId: t.meaningId,
      wordId: lexeme.id,
      isvWord: lexeme.value,
      translation: t.value,
    })

    let stdout: string
    try {
      stdout = execFileSync(VENV_PYTHON, ["process_words.py", "--single-word"], {
        cwd: PYTHON_DIR,
        input,
        encoding: "utf-8",
        timeout: 30_000,
      })
    } catch (err) {
      return NextResponse.json(
        { error: `Сопоставление с RuWordNet не удалось: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 },
      )
    }

    const entry: EnrichedEntry = JSON.parse(stdout)
    const computed = computeEntryData(entry, ruLookup)
    applySynsetsAndLinks(db, computed.synsetRows, computed.linkRows)
    const inserted = applyRelationsScoped(db, entry.meaningId, computed.relationRows)
    const synsetsMatched = entry.synsets?.length ?? 0

    results.push({
      meaningId: entry.meaningId,
      translation: t.value,
      synsetsMatched,
      relationsInserted: inserted,
      // Only worth computing when the exact lookup found nothing - a
      // moderator can then judge whether it's a typo/wrong wordform in the
      // translation itself, see lib/ruwordnet/fuzzyMatch.ts.
      fuzzyCandidates: synsetsMatched === 0 ? findFuzzyLemmaCandidates(t.value) : [],
    })
  }

  return NextResponse.json({ ok: true, results })
}
