import { GrammaticalCase } from '@/lib/grammar/common';

/**
 * Падежное управление предлогов. Перенесено из
 * lib/corpus/disambiguation/contextRules.ts (использовалось там для снятия
 * омонимии леммы по соседнему слову) — теперь общий источник истины и для
 * дизамбигуации, и для синтаксического парсера (deprel 'case').
 */
export const PREPOSITION_GOVERNMENT: Record<string, GrammaticalCase[]> = {
    v: [GrammaticalCase.LOC, GrammaticalCase.ACC],
    vo: [GrammaticalCase.LOC, GrammaticalCase.ACC],
    na: [GrammaticalCase.LOC, GrammaticalCase.ACC],
    o: [GrammaticalCase.LOC, GrammaticalCase.ACC],
    ob: [GrammaticalCase.LOC, GrammaticalCase.ACC],
    k: [GrammaticalCase.DAT],
    ko: [GrammaticalCase.DAT],
    bez: [GrammaticalCase.GEN],
    iz: [GrammaticalCase.GEN],
    do: [GrammaticalCase.GEN],
    ot: [GrammaticalCase.GEN],
    u: [GrammaticalCase.GEN],
    s: [GrammaticalCase.INS, GrammaticalCase.GEN],
    so: [GrammaticalCase.INS, GrammaticalCase.GEN],
    za: [GrammaticalCase.INS, GrammaticalCase.ACC],
    nad: [GrammaticalCase.INS],
    pod: [GrammaticalCase.INS, GrammaticalCase.ACC],
    pred: [GrammaticalCase.INS, GrammaticalCase.ACC],
    medzu: [GrammaticalCase.INS, GrammaticalCase.ACC],
    po: [GrammaticalCase.LOC, GrammaticalCase.DAT, GrammaticalCase.ACC],
    pro: [GrammaticalCase.ACC],
    pri: [GrammaticalCase.LOC],
    mimo: [GrammaticalCase.GEN],
    protiv: [GrammaticalCase.GEN],
    kromě: [GrammaticalCase.GEN],
    radi: [GrammaticalCase.GEN],
    dlja: [GrammaticalCase.GEN],
};

export function getExpectedCasesForPreposition(preposition: string): GrammaticalCase[] {
    const key = preposition.toLowerCase().trim();
    return PREPOSITION_GOVERNMENT[key] ?? [];
}

/**
 * UD-роль, которую занимает управляемое глаголом дополнение.
 */
export type VerbGovernmentRole = 'obj' | 'iobj' | 'obl';

export interface VerbGovernmentEntry {
    requiredCase: GrammaticalCase;
    role: VerbGovernmentRole;
    priority: number;
}

/**
 * Глагольное управление — в отличие от PREPOSITION_GOVERNMENT (закрытый,
 * стабильный список предлогов), специфично для каждой лексемы и требует
 * лингвистической проверки перед вводом (см. VerbGovernment в
 * prisma/corpus.schema.prisma и её комментарий). Хардкод-резерв намеренно
 * пуст — ни один факт вида "глагол X управляет падежом Y" здесь не
 * придумывается; данные вносятся только через будущую админку (Фаза 5) или
 * verified-скрипт заполнения, по аналогии с ending_allophones/endingLoader.ts.
 * Пока запись для леммы отсутствует и в БД, и здесь, парсер должен считать
 * дополнение обычным ACC-объектом с пониженной уверенностью ('heuristic'),
 * а не притворяться, что знает управление наверняка.
 */
const VERB_GOVERNMENT_FALLBACK: Record<string, VerbGovernmentEntry[]> = {};

type GovernmentCacheKey = `${string}:${'0' | '1'}`;

const verbGovernmentCache = new Map<GovernmentCacheKey, VerbGovernmentEntry[]>();
let loadAttempted = false;

export function loadVerbGovernmentOverridesSync(
    rows: { verbLemma: string; reflexive: boolean; requiredCase: string; role: string; priority: number }[]
): void {
    for (const row of rows) {
        const key = `${row.verbLemma}:${row.reflexive ? '1' : '0'}` as GovernmentCacheKey;
        const existing = verbGovernmentCache.get(key) ?? [];
        existing.push({
            requiredCase: row.requiredCase as GrammaticalCase,
            role: row.role as VerbGovernmentRole,
            priority: row.priority,
        });
        verbGovernmentCache.set(key, existing);
    }
    for (const entries of verbGovernmentCache.values()) {
        entries.sort((a, b) => a.priority - b.priority);
    }
}

function tryLoadFromDb(): void {
    if (loadAttempted || typeof window !== 'undefined') return;
    loadAttempted = true;
    try {
        const Database = require('better-sqlite3');
        const dbPath = process.env.CORPUS_SQLITE_DB || './corpus.db';
        const db = new Database(dbPath);
        const rows = db
            .prepare(
                `SELECT verbLemma, reflexive, requiredCase, role, priority FROM VerbGovernment`
            )
            .all() as { verbLemma: string; reflexive: number; requiredCase: string; role: string; priority: number }[];
        db.close();
        loadVerbGovernmentOverridesSync(rows.map(r => ({ ...r, reflexive: !!r.reflexive })));
    } catch {
        // БД недоступна (например, вызов из клиентского кода) — остаёмся на пустом резерве
    }
}

/**
 * Возвращает варианты управления для леммы глагола, отсортированные по
 * priority (см. VERB_GOVERNMENT_FALLBACK — сейчас всегда пусто без данных в БД).
 */
export function getVerbGovernment(verbLemma: string, reflexive: boolean = false): VerbGovernmentEntry[] {
    tryLoadFromDb();
    const key = `${verbLemma}:${reflexive ? '1' : '0'}` as GovernmentCacheKey;
    const dbEntries = verbGovernmentCache.get(key);
    if (dbEntries && dbEntries.length > 0) return dbEntries;
    return VERB_GOVERNMENT_FALLBACK[verbLemma] ?? [];
}

export function resetVerbGovernmentCache(): void {
    verbGovernmentCache.clear();
    loadAttempted = false;
}
