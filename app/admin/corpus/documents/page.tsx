import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prismaCorpus } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import CorpusDocumentsPage from "./_page"

export const metadata: Metadata = {
  title: "Документы корпуса | Админ-панель",
  description: "Список документов в корпусе межславянского языка.",
}

const CorpusDocumentsPageWrapper = async () => {
  const session = await auth()
  if (!session) redirect("/login")

  await requirePermission(session, Feature.CorpusBuilder)

  const documents = await prismaCorpus.corpusDocument.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      author: true,
      createdAt: true,
      updatedAt: true,
      candidatesProcessed: true,
    },
  })

  const freqConfig = await prismaCorpus.corpusConfig.findUnique({
    where: { key: "freq_last_recalculated" },
  })
  const freqLastRecalculated = freqConfig?.value
    ? new Date(freqConfig.value)
    : null

  const cefrConfig = await prismaCorpus.corpusConfig.findUnique({
    where: { key: "cefr_last_recalculated" },
  })
  const cefrLastRecalculated = cefrConfig?.value
    ? new Date(cefrConfig.value)
    : null

  const latestUpdatedAt = documents.reduce<Date | null>((latest, doc) => {
    if (!latest) return doc.updatedAt
    return doc.updatedAt > latest ? doc.updatedAt : latest
  }, null)

  return (
    <CorpusDocumentsPage
      documents={documents}
      freqLastRecalculated={freqLastRecalculated?.toISOString() ?? null}
      cefrLastRecalculated={cefrLastRecalculated?.toISOString() ?? null}
      latestDocUpdatedAt={latestUpdatedAt?.toISOString() ?? null}
    />
  )
}

export default CorpusDocumentsPageWrapper