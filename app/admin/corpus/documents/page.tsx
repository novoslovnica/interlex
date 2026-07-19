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
      candidatesProcessed: true,
    },
  })

  return <CorpusDocumentsPage documents={documents} />
}

export default CorpusDocumentsPageWrapper