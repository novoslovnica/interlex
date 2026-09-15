// Пересчитывает признаки кластеров очереди кандидатов (иностранный контекст,
// словоизменение, распределённость) и применяет статусы — см.
// lib/corpus/candidates/clusterSignals.ts. Запускать после генерации
// предложений; corpus:refresh делает это сам.
//
// Требует таблицу из scripts/db/2026-09-15-add-corpus-cluster-signals.ts.
//
// Usage: npx tsx scripts/db/compute-corpus-cluster-signals.ts

import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true })

async function main() {
    const { computeClusterSignals } = await import("@/lib/corpus/candidates/clusterSignals")
    const started = Date.now()
    const stats = await computeClusterSignals()
    console.log(`Готово за ${((Date.now() - started) / 1000).toFixed(1)}s`)
    console.log(stats)
    process.exit(0)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
