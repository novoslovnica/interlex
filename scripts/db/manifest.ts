// Какие скрипты можно запускать на базах через scripts/db/run.ts.
//
// Скрипты scripts/db/*.ts с датой раньше LEGACY_CUTOFF - история: на проде
// они уже применены (прод получил снимок локальной базы 2026-09-23/24, в
// котором есть всё, а auth.db мигрировался на месте при каждом релизе).
// В манифест они не вносятся и раннером не запускаются.
//
// Новый скрипт, меняющий базу, добавляется сюда в том же коммите:
//   kind: "schema"     - идемпотентный DDL; применяется сам при релизе (run.ts migrate,
//                        служба остановлена), dry-run не нужен.
//   kind: "data"       - разовая правка данных; на проде только руками:
//                        `bash prod.sh run <path>` (dry-run), потом `... --apply`.
//   kind: "repeatable" - пересчёт, который гоняют сколько угодно раз
//                        (частотность, статистика, сигналы).
// dryRun: скрипт понимает контракт "без --apply ничего не пишет" (для data -
// обязательно). Скрипт без dry-run (dryRun: false) запускается только с --apply.
// Контракт data-скрипта - AGENTS.md, раздел "Production data changes".

export type DbName = "interlex" | "auth" | "library" | "corpus" | "historical"
export type ScriptKind = "schema" | "data" | "repeatable"

export interface ManifestEntry {
    /** Путь от корня репозитория. */
    path: string
    /** База, которую скрипт меняет: там реестр и её бэкап перед --apply. */
    db: DbName
    kind: ScriptKind
    /** Поддерживает ли скрипт dry-run (запуск без --apply ничего не пишет). */
    dryRun: boolean
    /** Долгий (десятки минут и больше): на проде запускать с --detach. */
    heavy?: boolean
    /** Не делать бэкап базы перед --apply (corpus.db - 5 ГБ, скрипт сам безопасен). */
    noBackup?: boolean
    /** Меняет схему, которую читает Prisma-клиент: после него нужен рестарт службы. */
    needsRestart?: boolean
    note?: string
}

export const LEGACY_CUTOFF = "2026-09-25"

export const DB_FILES: Record<DbName, string> = {
    interlex: "interlex.db",
    auth: "auth.db",
    library: "library.db",
    corpus: "corpus.db",
    historical: "historical.db",
}

export const MANIFEST: ManifestEntry[] = [
    // Пересчёты, которые гоняют на проде после изменений словаря или корпуса.
    { path: "scripts/compute-lexicon-frequency.ts", db: "interlex", kind: "repeatable", dryRun: false, note: "частотность и CEFR из corpus.db в lexemes; после замены corpus.db" },
    { path: "scripts/db/recompute-contributor-stats.ts", db: "interlex", kind: "repeatable", dryRun: false },
    { path: "scripts/db/compute-proper-noun-signals.ts", db: "interlex", kind: "repeatable", dryRun: false, note: "не во время реанализа корпуса" },
]

export function findEntry(scriptPath: string): ManifestEntry | undefined {
    const norm = scriptPath.replace(/^\.\//, "")
    return MANIFEST.find((e) => e.path === norm)
}

/** Датированные скрипты до LEGACY_CUTOFF - уже применённая история. */
export function isLegacyScript(scriptPath: string): boolean {
    const m = /(?:^|\/)(\d{4}-\d{2}-\d{2})-[^/]+$/.exec(scriptPath)
    return !!m && m[1] < LEGACY_CUTOFF
}

/** Схемные миграции в порядке применения (по имени файла - оно начинается с даты). */
export function schemaMigrations(): ManifestEntry[] {
    return MANIFEST.filter((e) => e.kind === "schema").sort((a, b) => path_base(a.path).localeCompare(path_base(b.path)))
}

function path_base(p: string): string {
    return p.slice(p.lastIndexOf("/") + 1)
}
