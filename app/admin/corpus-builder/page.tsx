import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"

const CorpusBuilderRedirectPage = async () => {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.CorpusBuilder)
  redirect("/admin/corpus/builder")
}

export default CorpusBuilderRedirectPage