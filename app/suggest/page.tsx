import SuggestWordForm from "@/components/SuggestWordForm"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("suggestWord")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function SuggestPage({
  searchParams,
}: {
  searchParams: Promise<{ value?: string }>
}) {
  const t = await getTranslations("suggestWord")
  const { value } = await searchParams

  return (
    <div className="min-h-full py-10 bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0f172a] dark:text-slate-100">
      <div className="max-w-lg mx-auto px-4 md:px-6 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <SuggestWordForm initialValue={value} className="bg-background border rounded-2xl p-6 shadow-sm" />
      </div>
    </div>
  )
}
