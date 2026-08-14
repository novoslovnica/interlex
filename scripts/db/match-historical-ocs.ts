// Матчер для старослав. ветви (branch='south') — ТОЛЬКО proto-мост, без
// эвристики по stem/value (см. lib/historical/branches/ocsReflex.ts и
// AGENTS.md "Historical Corpora"). Структура и пороги — общие с
// match-historical-birchbark.ts (lib/historical/matcher.ts).
//
// Usage: npx tsx -r dotenv/config scripts/db/match-historical-ocs.ts

import { prismaHistorical, prismaData } from "@/lib/prisma"
import { applyOldChurchSlavonicReflex } from "@/lib/historical/branches/ocsReflex"
import { findBestMatch, statusForConfidence, ReflexCandidate } from "@/lib/historical/matcher"

const BRANCH = "south"
const HUMAN_STATUSES = new Set(["rejected", "manually_confirmed"])

async function main() {
    console.log("Loading lexemes with proto from interlex.db...")
    const lexemes = await prismaData.lexeme.findMany({
        where: { isCollocation: false, proto: { not: null } },
        select: { id: true, proto: true, pos: true },
    })
    console.log(`  ${lexemes.length} lexemes with proto`)

    console.log("Building OCS reflex candidate index...")
    const byFirstChar = new Map<string, ReflexCandidate[]>()
    let candidateCount = 0
    for (const lex of lexemes) {
        const seen = new Set<string>()
        for (const cand of applyOldChurchSlavonicReflex(lex.proto!)) {
            if (!cand || seen.has(cand)) continue
            seen.add(cand)
            const key = cand[0]
            if (!byFirstChar.has(key)) byFirstChar.set(key, [])
            byFirstChar.get(key)!.push({ lexemeId: lex.id, candidate: cand, method: "proto_bridge", pos: lex.pos })
            candidateCount++
        }
    }
    console.log(`  ${candidateCount} candidate reflex strings indexed`)

    console.log("Loading distinct historical lemmas (branch=south)...")
    const tokens = await prismaHistorical.historicalToken.findMany({
        where: { document: { branch: BRANCH } },
        select: { id: true, lemmaTranslit: true, upos: true },
    })
    const byLemma = new Map<string, { ids: bigint[]; upos: string }>()
    for (const t of tokens) {
        if (!t.lemmaTranslit || t.upos === "PUNCT" || t.upos === "X" || t.upos === "SYM") continue
        if (!byLemma.has(t.lemmaTranslit)) byLemma.set(t.lemmaTranslit, { ids: [], upos: t.upos })
        byLemma.get(t.lemmaTranslit)!.ids.push(t.id)
    }
    console.log(`  ${byLemma.size} distinct lemmas\n`)

    let autoConfirmed = 0
    let proposed = 0
    let noMatch = 0
    let skippedHuman = 0

    for (const [lemma, { ids, upos }] of byLemma) {
        const bucket = byFirstChar.get(lemma[0]) || []
        const match = findBestMatch(lemma, bucket)
        if (!match) {
            noMatch++
            continue
        }

        const status = statusForConfidence(match.confidence, lemma.length, upos, match.pos)
        if (status === "auto_confirmed") autoConfirmed++
        else proposed++

        const existing = await prismaHistorical.historicalAttestation.findUnique({
            where: { branch_historicalLemma_lexemeId: { branch: BRANCH, historicalLemma: lemma, lexemeId: match.lexemeId } },
        })
        const exampleTokenIds = ids.slice(0, 5).map((id) => id.toString())

        if (existing) {
            if (HUMAN_STATUSES.has(existing.status)) {
                skippedHuman++
                await prismaHistorical.historicalAttestation.update({ where: { id: existing.id }, data: { occurrenceCount: ids.length, exampleTokenIds } })
                continue
            }
            await prismaHistorical.historicalAttestation.update({
                where: { id: existing.id },
                data: { confidence: match.confidence, status, occurrenceCount: ids.length, exampleTokenIds, matchMethod: match.method },
            })
        } else {
            await prismaHistorical.historicalAttestation.create({
                data: {
                    branch: BRANCH,
                    historicalLemma: lemma,
                    lexemeId: match.lexemeId,
                    matchMethod: match.method,
                    confidence: match.confidence,
                    status,
                    occurrenceCount: ids.length,
                    exampleTokenIds,
                },
            })
        }
    }

    console.log("=== Результат ===")
    console.log("auto_confirmed:", autoConfirmed)
    console.log("proposed:", proposed)
    console.log("без совпадения:", noMatch)
    console.log("пропущено (тронуто вручную):", skippedHuman)

    await prismaHistorical.$disconnect()
    await prismaData.$disconnect()
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
