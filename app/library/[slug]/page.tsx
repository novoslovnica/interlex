import { notFound } from "next/navigation"
import Link from "next/link"
import { prismaLibrary as db } from "@/lib/prisma"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { getFlavorLabel } from "@/config/flavor"
import type { Metadata } from "next"
import {getTranslations} from "next-intl/server"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const t = await getTranslations("library");
  const entry = await db.libraryEntry.findUnique({ where: { slug } })
  if (!entry) return { title: t("notFound") }
  return {
    title: `${entry.title} — ${t("title")}`,
    description: entry.summary || `${t("description")} ${entry.title}`,
  }
}

const categoryLabels: Record<string, string> = {
  poem: "Poema",
  article: "Členok",
  book: "Kniga",
  joke: "Zasměška",
  story: "Povědka",
  song: "Pěsńa",
  prayer: "Molitva",
  quote: "Citata",
  study: "Nauka",
}

const flavorLabels: Record<string, string> = {}

const icons: Record<string, string> = {
  poem: "📜", article: "📰", book: "📖", joke: "😂",
  story: "✍️", song: "🎶", prayer: "🙏", quote: "💬", study: "🎓",
}

export default async function LibraryReadingPage({ params }: PageProps) {
  const { slug } = await params
  const t = await getTranslations("library");
  const entry = await db.libraryEntry.findUnique({ where: { slug } })
  if (!entry) notFound()

  await db.libraryEntry.update({
    where: { slug },
    data: { views: { increment: 1 } },
  })

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Link
          href="/library"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("backLink")}
        </Link>

        <article className="space-y-6">
          <header className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>{icons[entry.category] || "📄"} {categoryLabels[entry.category] || entry.category}</span>
              <span>·</span>
              <span>{getFlavorLabel(entry.flavor)}</span>
              <span>·</span>
              <span>{entry.author || "Neznany autor"}</span>
              {entry.translator && (
                <>
                  <span>·</span>
                  <span>Prevod: {entry.translator}</span>
                </>
              )}
              {entry.yearWritten && (
                <>
                  <span>·</span>
                  <span>{entry.yearWritten}{entry.yearTranslated ? ` → ${entry.yearTranslated}` : ""}</span>
                </>
              )}
              {entry.verified && (
                <>
                  <span>·</span>
                  <span className="text-green-600 font-semibold">{t("verified")}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">{entry.title}</h1>
            {entry.summary && (
              <p className="text-sm text-muted-foreground leading-relaxed">{entry.summary}</p>
            )}
            {entry.source && (
              <p className="text-xs text-muted-foreground">
                {t("source")}{" "}
                <a href={entry.source} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                  {entry.source}
                </a>
              </p>
            )}
          </header>

          {entry.body ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownRenderer content={entry.body} />
            </div>
          ) : (
            <p className="text-muted-foreground italic">{t("emptyBody")}</p>
          )}
        </article>
      </div>
    </div>
  )
}