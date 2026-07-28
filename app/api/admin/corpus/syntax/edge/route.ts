import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaCorpus } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { UD_DEPREL } from "@/lib/corpus/syntax"

const VALID_RELATIONS = new Set<string>(Object.values(UD_DEPREL))

/**
 * Ручная правка одного ребра dependency-графа (Фаза 5). source='manual' —
 * не 'auto', чтобы повторный автоматический разбор (POST .../parse-syntax)
 * не затирал правку модератора: saveDependencies (lib/corpus/syntax/persist.ts)
 * удаляет и пересоздаёт только source='auto' строки. Тот же приём, что и
 * у semantic_relations (см. AGENTS.md "Semantic Network").
 */
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusSyntaxEdit))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = await request.json()
  const { depTokenId, headTokenId, relation } = body as {
    depTokenId?: string
    headTokenId?: string | null
    relation?: string
  }

  if (!depTokenId || !relation) {
    return NextResponse.json({ error: "depTokenId и relation обязательны" }, { status: 400 })
  }
  if (!VALID_RELATIONS.has(relation)) {
    return NextResponse.json({ error: `Неизвестная связь: ${relation}` }, { status: 400 })
  }

  let depId: bigint
  let headId: bigint | null
  try {
    depId = BigInt(depTokenId)
    headId = headTokenId ? BigInt(headTokenId) : null
  } catch {
    return NextResponse.json({ error: "depTokenId/headTokenId должны быть целыми числами" }, { status: 400 })
  }

  if (headId !== null && headId === depId) {
    return NextResponse.json({ error: "Токен не может быть головой самого себя" }, { status: 400 })
  }

  const depToken = await prismaCorpus.corpusToken.findUnique({
    where: { id: depId },
    select: { sentenceId: true },
  })
  if (!depToken) {
    return NextResponse.json({ error: "Токен не найден" }, { status: 404 })
  }
  if (headId !== null) {
    const headToken = await prismaCorpus.corpusToken.findUnique({
      where: { id: headId },
      select: { sentenceId: true },
    })
    if (!headToken || headToken.sentenceId !== depToken.sentenceId) {
      return NextResponse.json({ error: "Голова должна быть токеном того же предложения" }, { status: 400 })
    }
  }

  const saved = await prismaCorpus.corpusDependency.upsert({
    where: { depTokenId: depId },
    update: { headTokenId: headId, relation, confidence: "rule", source: "manual" },
    create: { sentenceId: depToken.sentenceId, depTokenId: depId, headTokenId: headId, relation, confidence: "rule", source: "manual" },
  })

  return NextResponse.json({
    ok: true,
    edge: {
      depTokenId: saved.depTokenId.toString(),
      headTokenId: saved.headTokenId?.toString() ?? null,
      relation: saved.relation,
      confidence: saved.confidence,
      source: saved.source,
    },
  })
}
