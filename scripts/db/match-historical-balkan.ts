// Матчер для балканослав. ветви (branch='balkan') — proto-мост + эвристика
// по stem/value (как у восточнослав., см. match-historical-birchbark.ts),
// в отличие от старослав. (только proto-мост).
//
// Usage: npx tsx -r dotenv/config scripts/db/match-historical-balkan.ts

import { prismaHistorical, prismaData } from "@/lib/prisma"
import { applyBalkanReflex } from "@/lib/historical/branches/balkanReflex"
import { findBestMatch, statusForConfidence, ReflexCandidate } from "@/lib/historical/matcher"

const BRANCH = "balkan"
const HUMAN_STATUSES = new Set(["rejected", "manually_confirmed"])

async function main() {
    console.log("Loading lexemes from interlex.db...")
    const lexemes = await prismaData.lexeme.findMany({
        where: { isCollocation: false },
        select: { id: true, proto: true, stem: true, value: true, pos: true },
    })
    console.log(`  ${lexemes.length} lexemes`)

    console.log("Building Balkan reflex candidate index...")
    const byFirstChar = new Map<string, ReflexCandidate[]>()
    let candidateCount = 0
    for (const lex of lexemes) {
        const seen = new Set<string>()
        if (lex.proto) {
            for (const cand of applyBalkanReflex(lex.proto)) {
                if (!cand || seen.has("p:" + cand)) continue
                seen.add("p:" + cand)
                pushCandidate(byFirstChar, { lexemeId: lex.id, candidate: cand, method: "proto_bridge", pos: lex.pos })
                candidateCount++
            }
        }
        const base = lex.stem || lex.value
        if (base) {
            for (const cand of applyBalkanReflex(base)) {
                if (!cand || seen.has("h:" + cand)) continue
                seen.add("h:" + cand)
                pushCandidate(byFirstChar, { lexemeId: lex.id, candidate: cand, method: "phonetic_heuristic", pos: lex.pos })
                candidateCount++
            }
        }
    }
    console.log(`  ${candidateCount} candidate reflex strings indexed`)

    console.log("Loading distinct historical lemmas (branch=balkan)...")
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

function pushCandidate(index: Map<string, ReflexCandidate[]>, c: ReflexCandidate) {
    const key = c.candidate[0]
    if (!index.has(key)) index.set(key, [])
    index.get(key)!.push(c)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
