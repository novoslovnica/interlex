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
    /** Schema remains readable/writable by the previous release (expand/contract). */
    rollbackSafe?: boolean
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
    { path: "scripts/db/2026-11-25-review-morpheme-affixes.ts", db: "interlex", kind: "data", dryRun: true, note: "инвентарь 13 аффиксов и первая сверенная пачка привязок морфем" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-02.ts", db: "interlex", kind: "data", dryRun: true, note: "вторая пачка привязок по проверенным производящим словам" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-03.ts", db: "interlex", kind: "data", dryRun: true, note: "сверенные привязки pri- и исправление корней in и um" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-04.ts", db: "interlex", kind: "data", dryRun: true, note: "редакторские решения по -ak, включая разбор kozak и kazak" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-05.ts", db: "interlex", kind: "data", dryRun: true, note: "редакторская сверка -ec по производящим основам" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-06.ts", db: "interlex", kind: "data", dryRun: true, note: "редакторская сверка -telj по глагольным основам" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-07.ts", db: "interlex", kind: "data", dryRun: true, note: "редакторская сверка приставки do- и ложных совпадений" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-08.ts", db: "interlex", kind: "data", dryRun: true, note: "семьи lov и lěč, исправление ошибочных корневых связей lodz и zdrad" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-09.ts", db: "interlex", kind: "data", dryRun: true, note: "редакторская сверка -ost по словарным основам и значениям" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-10.ts", db: "interlex", kind: "data", dryRun: true, note: "редакторская сверка общих корней и исправление ошибочных групп" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-11.ts", db: "interlex", kind: "data", dryRun: true, note: "редакторская сверка -stv- по словарным основам" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-12.ts", db: "interlex", kind: "data", dryRun: true, note: "редакторская сверка приставок bez-, ne- и na-" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-13.ts", db: "interlex", kind: "data", dryRun: true, note: "редакторская сверка приставки pri- и перенос проверенных связей" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-14.ts", db: "interlex", kind: "data", dryRun: true, note: "снятие оставшихся неверных связей с прежним корнем pri" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-15.ts", db: "interlex", kind: "data", dryRun: true, note: "редакторская сверка -nik и соседних словообразовательных моделей" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-16.ts", db: "interlex", kind: "data", dryRun: true, note: "редакторская сверка -k- и ложных совпадений на -ka" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-17.ts", db: "interlex", kind: "data", dryRun: true, note: "первая редакторская пачка -n- по существительным и прилагательным" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-18.ts", db: "interlex", kind: "data", dryRun: true, note: "сверка значений для пар с предложенной основой -n-" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-19.ts", db: "interlex", kind: "data", dryRun: true, note: "проверенные сочетания -n- с приставками и сложением" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-20.ts", db: "interlex", kind: "data", dryRun: true, note: "разграничение относительных прилагательных на -n- и причастий" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-21.ts", db: "interlex", kind: "data", dryRun: true, note: "сверка -n- по основам существительных и составным словам" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-22.ts", db: "interlex", kind: "data", dryRun: true, note: "сверка -n- по подтверждённым компонентам сложных прилагательных" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-23.ts", db: "interlex", kind: "data", dryRun: true, note: "сверка -n- с международными словообразовательными формантами" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-24.ts", db: "interlex", kind: "data", dryRun: true, note: "сверка сложных слов, корневой n и страдательных причастий" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-25.ts", db: "interlex", kind: "data", dryRun: true, note: "фиксация случаев -n-, требующих дополнительных словарных свидетельств" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-26.ts", db: "interlex", kind: "data", dryRun: true, note: "исправление корня уч- и дополнение проверенной семьи" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-27.ts", db: "interlex", kind: "data", dryRun: true, note: "повторная сверка самых частотных отложенных пар" },
    { path: "scripts/db/2026-11-25-review-morpheme-affixes-28.ts", db: "interlex", kind: "data", dryRun: true, note: "вторая сверка частотных отложенных морфем" },
    // Схемные миграции (идемпотентный DDL) - применяются сами при релизе
    // (run.ts migrate, служба остановлена). Порядок - по имени файла.
    //
    // Критично: до перехода на реестр (98b0387) релиз прогонял фиксированный
    // список этих DDL-скриптов прямо в rebuild-remote.sh. В манифест его не
    // перенесли, и они перестали применяться на проде: community-таблицы
    // (word_comments, translation_votes, contributor_stats) и auth-таблицы
    // (user_profiles и др.) на проде отсутствовали, из-за чего /words/[id]
    // падал с "no such table" (2026-10-13). Каждая миграция идемпотентна.
    { path: "scripts/db/2026-08-12-add-telegram-auth-nonce.ts", db: "auth", kind: "schema", dryRun: false, rollbackSafe: true, needsRestart: true, note: "telegram_auth_nonces (replay-защита входа через Telegram)" },
    { path: "scripts/db/2026-09-19-add-community-auth-tables.ts", db: "auth", kind: "schema", dryRun: false, rollbackSafe: true, needsRestart: true, note: "user_languages / user_profiles / role_audit" },
    { path: "scripts/db/2026-09-19-add-community-translation-votes.ts", db: "interlex", kind: "schema", dryRun: false, rollbackSafe: true, needsRestart: true, note: "translation_votes + translations.community*" },
    { path: "scripts/db/2026-09-19-add-community-reputation.ts", db: "interlex", kind: "schema", dryRun: false, rollbackSafe: true, needsRestart: true, note: "translation_votes.agreed/controlExpected + contributor_stats" },
    { path: "scripts/db/2026-09-23-add-word-comments.ts", db: "interlex", kind: "schema", dryRun: false, rollbackSafe: true, needsRestart: true, note: "word_comments (обсуждение на странице слова)" },
    { path: "scripts/db/2026-10-14-add-corpus-homonym-group-key.ts", db: "corpus", kind: "schema", dryRun: false, rollbackSafe: true, needsRestart: true, note: "CorpusToken.homonymGroupKey + индекс (очередь массовой разметки омонимов, п.111)" },

    { path: "scripts/db/2026-10-18-add-homonym-review-history.ts", db: "corpus", kind: "schema", dryRun: false, rollbackSafe: true, note: "контекстная разметка омонимов: журнал пакетов и защита отката от последующих правок" },

    { path: "scripts/db/2026-10-19-add-corpus-workbench.ts", db: "corpus", kind: "schema", dryRun: false, rollbackSafe: true, needsRestart: true, note: "отдельное рабочее место: версии токенов и журнал точечных правок" },

    { path: "scripts/db/2026-11-03-add-corpus-editor-assistance.ts", db: "corpus", kind: "schema", dryRun: false, rollbackSafe: true, needsRestart: true, note: "личные задачи редактора и индекс похожих вхождений; анализ токенов не меняется" },

    { path: "scripts/db/2026-11-25-add-word-notes.ts", db: "auth", kind: "schema", dryRun: false, rollbackSafe: true, needsRestart: true, note: "личные заметки на словах" },

    // Пересчёты, которые гоняют на проде после изменений словаря или корпуса.
    { path: "scripts/compute-lexicon-frequency.ts", db: "interlex", kind: "repeatable", dryRun: false, note: "частотность и CEFR из corpus.db в lexemes; после замены corpus.db" },
    { path: "scripts/db/recompute-contributor-stats.ts", db: "interlex", kind: "repeatable", dryRun: false },
    { path: "scripts/db/compute-proper-noun-signals.ts", db: "interlex", kind: "repeatable", dryRun: false, note: "создаёт proper_noun_signals; не во время реанализа корпуса" },
    { path: "scripts/export-hunspell.ts", db: "interlex", kind: "repeatable", dryRun: false, noBackup: true, note: "только читает; пишет exports/hunspell/ (страница /downloads)" },
    { path: "scripts/db/2026-11-24-add-relative-adjective-suffixes.ts", db: "interlex", kind: "data", dryRun: true, note: "подтверждённые суффиксы ov/ev/sk и три словарных примера" },
    { path: "scripts/db/2026-11-25-restore-modern-participle-endings.ts", db: "interlex", kind: "data", dryRun: true, note: "восстановление подтверждённых окончаний причастий CORE из сверки 2026-09-15" },
    { path: "scripts/db/2026-11-25-add-kolozor-podcast.ts", db: "library", kind: "data", dryRun: true, note: "подкаст Kolozor в медиатеке" },
    { path: "scripts/db/2026-11-25-realign-meaning-texts.ts", db: "interlex", kind: "data", dryRun: true, note: "сверка определений и примеров с переводами после июльского импорта" },
    { path: "scripts/db/2026-11-25-add-znacenje-core-allophone.ts", db: "interlex", kind: "data", dryRun: true, note: "аллофон CORE značenje для записи №25508" },
    { path: "scripts/db/2026-11-25-stage-reviewed-corpus-lexemes.ts", db: "interlex", kind: "data", dryRun: true, note: "черновики лексем, подтверждённых корпусными контекстами" },
    { path: "scripts/db/2026-11-25-link-reviewed-corpus-forms.ts", db: "corpus", kind: "data", dryRun: true, noBackup: true, note: "привязка проверенных словоформ к черновикам после их создания, старые строки сохраняются в журнале запуска" },
    { path: "scripts/db/import-new-isv-wikipedia.ts", db: "corpus", kind: "repeatable", dryRun: true, heavy: true, note: "добавляет новые статьи Википедии после контрольного ID, сохраняет существующую разметку" },
    {
        path: "scripts/db/analyze-homonym-duplicates.ts",
        db: "corpus",
        kind: "repeatable",
        dryRun: true,
        noBackup: true,
        note: "только читает corpus.db + interlex.db: группы омонимии с признаками дублей лексем (вход в дедупликацию, п.113)",
    },
    {
        path: "scripts/db/2026-10-14-backfill-homonym-group-keys.ts",
        db: "corpus",
        kind: "data",
        dryRun: true,
        heavy: true,
        noBackup: true,
        note: "разовое заполнение CorpusToken.homonymGroupKey; ~2,5 мин, запускать с --detach после DDL-миграции",
    },
    {
        path: "scripts/db/2026-10-14-merge-safe-homonym-duplicates.ts",
        db: "interlex",
        kind: "data",
        dryRun: true,
        heavy: true,
        note: "7 SAFE-пар дублей (разметка мейнтейнера 2026-10-14): слияние лексем + перенос частотности; заодно перенаправляет ссылки в corpus.db (два прохода по 12,9 млн кандидатов)",
    },
    {
        path: "scripts/db/2026-10-15-normalize-value-diacritics.ts",
        db: "interlex",
        kind: "data",
        dryRun: true,
        heavy: true,
        note: "value -> поисковая форма без диакритики + слаг по <value>-<POS> (коллизия -> -2); ~2,5 тыс. лексем, перевязка corpus.db; редиректы не делаются",
    },
    {
        path: "scripts/db/2026-10-15-rename-legacy-slugs.ts",
        db: "interlex",
        kind: "data",
        dryRun: true,
        heavy: true,
        note: "слаги старого образца (диакритика в слаге при ASCII value) -> <value>-<POS>; ~1,4 тыс. лексем, перевязка corpus.db",
    },
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
