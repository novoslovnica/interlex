import type { DbAnalyzer } from "@/lib/corpus/tokenizer/dbAnalyzer"

// Анализатор форм для ботов (форма -> лемма: "vodu" -> voda). Собирается
// лениво и долго (~20 с: индекс всех форм словаря), поэтому боты не ждут его:
// первый запрос запускает сборку, а пока анализатор не готов, поиск идёт только
// по словарю (lookup.ts). Один экземпляр на процесс - бот работает в процессе
// Next (AGENTS.md, "Bots").

let analyzer: DbAnalyzer | null = null
let building: Promise<DbAnalyzer> | null = null

export function getAnalyzerIfReady(): DbAnalyzer | null {
    if (analyzer) return analyzer
    if (!building) {
        building = import("@/lib/corpus/tokenizer/analyzer-factory")
            .then(({ createDbAnalyzer }) => createDbAnalyzer())
            .then((a) => (analyzer = a))
            .catch((e: unknown) => {
                console.error("bots: analyzer build failed", e)
                building = null
                throw e
            })
        building.catch(() => { /* логируется выше; следующий запрос попробует снова */ })
    }
    return null
}

/** Для тестов и прогрева: дождаться анализатора. */
export async function waitForAnalyzer(): Promise<DbAnalyzer> {
    getAnalyzerIfReady()
    return analyzer ?? building!
}
