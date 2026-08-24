// Убирает дубликаты в candidates, возникшие до правки одобрения
// (см. коммит "Approve a word once, not once per inflected form").
//
// Одно слово попадало в очередь ревью столькими кластерами, сколько его
// словоформ встретилось в корпусе, и каждое одобрение создавало нового
// кандидата: "medžuslovjansky" был одобрен по кластерам medžuslovjansky,
// medžuslovjanskom и medžuslovjanskogo — три одинаковые записи, из которых
// на промоушене вышло бы три дубликата лексемы.
//
// Оставляет запись с наименьшим id в каждой группе (value, pos) среди ещё не
// промотированных, перевешивает на неё ссылки CorpusCandidateProposal.candidateId
// (это обычный Int без внешнего ключа — corpus.db и interlex.db не связаны)
// и удаляет остальные. Идемпотентен.
//
// Usage: npx tsx -r dotenv/config scripts/db/2026-08-25-dedupe-corpus-candidates.ts [--apply]

import { prismaData, prismaCorpus } from "@/lib/prisma"
import { logAudit } from "@/lib/audit-log"

async function main() {
    const apply = process.argv.includes("--apply")

    const candidates = await prismaData.candidate.findMany({
        where: { promotedAt: null },
        select: { id: true, value: true, pos: true },
        orderBy: { id: "asc" },
    })

    const keepByKey = new Map<string, number>()
    const doomed: { id: number; keepId: number; value: string; pos: string | null }[] = []
    for (const c of candidates) {
        const key = `${c.value}|${c.pos ?? ""}`
        const keepId = keepByKey.get(key)
        if (keepId === undefined) keepByKey.set(key, c.id)
        else doomed.push({ id: c.id, keepId, value: c.value ?? "", pos: c.pos })
    }

    console.log(`Кандидатов без промоушена: ${candidates.length}, дубликатов: ${doomed.length}`)
    for (const d of doomed) console.log(`  id=${d.id} "${d.value}"/${d.pos} -> оставляем id=${d.keepId}`)

    if (doomed.length === 0) return
    if (!apply) {
        console.log("\nЭто прогон вхолостую. Повторите с --apply.")
        return
    }

    for (const d of doomed) {
        const repointed = await prismaCorpus.corpusCandidateProposal.updateMany({
            where: { candidateId: d.id },
            data: { candidateId: d.keepId },
        })
        await prismaData.candidate.delete({ where: { id: d.id } })
        await logAudit(undefined, "Candidate", d.id, [
            { field: "duplicateOf", oldValue: null, newValue: String(d.keepId) },
            { field: "deleted", oldValue: `${d.value}/${d.pos ?? ""}`, newValue: null },
        ])
        console.log(`  удалён id=${d.id}, перевешено предложений: ${repointed.count}`)
    }
}

main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => { void prismaData.$disconnect(); void prismaCorpus.$disconnect() })
