import { prismaHistorical } from "@/lib/prisma"

export interface HistoricalAttestationDTO {
    branch: string
    branchLabel: string
    historicalLemma: string
    occurrenceCount: number
    matchMethod: string
    example: { form: string; sentenceText: string; documentTitle: string; period: string | null } | null
}

const BRANCH_LABEL: Record<string, string> = {
    east: "восточнославянская",
    south: "старославянская",
    balkan: "балканославянская",
}

/**
 * Подтверждённые (auto_confirmed/manually_confirmed) сопоставления слова с
 * историческими корпусами (грамоты/старослав./балканослав.), для отображения
 * на публичной странице слова. См. lib/corpus/fetchWordExamples.ts за тем же
 * паттерном — historical.db отдельная БД от interlex.db, join невозможен,
 * вызывающий код (page.tsx) отвечает за передачу lexemeId (Lexeme.id) и
 * мерж результата.
 */
export async function fetchHistoricalAttestations(lexemeId: number): Promise<HistoricalAttestationDTO[]> {
    if (!lexemeId) return []

    const attestations = await prismaHistorical.historicalAttestation.findMany({
        where: { lexemeId, status: { in: ["auto_confirmed", "manually_confirmed"] } },
        orderBy: { occurrenceCount: "desc" },
    })
    if (attestations.length === 0) return []

    const firstTokenIds = attestations
        .map((a) => (a.exampleTokenIds as string[])[0])
        .filter((id): id is string => !!id)
        .map((id) => BigInt(id))

    const tokens = firstTokenIds.length
        ? await prismaHistorical.historicalToken.findMany({
            where: { id: { in: firstTokenIds } },
            select: { id: true, form: true, sentence: { select: { rawText: true } }, document: { select: { title: true, period: true } } },
        })
        : []
    const tokenById = new Map(tokens.map((t) => [t.id.toString(), t]))

    return attestations.map((a) => {
        const firstId = (a.exampleTokenIds as string[])[0]
        const token = firstId ? tokenById.get(firstId) : undefined
        return {
            branch: a.branch,
            branchLabel: BRANCH_LABEL[a.branch] ?? a.branch,
            historicalLemma: a.historicalLemma,
            occurrenceCount: a.occurrenceCount,
            matchMethod: a.matchMethod,
            example: token
                ? { form: token.form, sentenceText: token.sentence.rawText, documentTitle: token.document.title, period: token.document.period }
                : null,
        }
    })
}
