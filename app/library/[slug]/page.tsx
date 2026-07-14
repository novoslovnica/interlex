import { notFound } from "next/navigation"
import Link from "next/link"
import { prismaLibrary as db } from "@/lib/prisma"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { decompressBody } from "@/lib/body"
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

const genreLabels: Record<string, string> = {
  novel: "Roman",
  novella: "Pověst",
  short_story: "Razkaz",
  miniature: "Miniatura",
  poetry: "Poezija",
  drama: "Drama",
  song: "Pěsńa",
  article: "Členok",
  news: "Novosti",
  essay: "Esej",
  fairy_tale: "Bajka",
  biography: "Biografija",
  correspondence: "Korespondencija",
}

const topicLabels: Record<string, string> = {
  fiction: "Fikcija",
  history_society: "Historija i obščestvo",
  language_culture: "Język i kultura",
  folklore: "Folklore",
  science_tech: "Nauka i tehnologije",
  news_events: "Novosti i sobytja",
}

const genreIcons: Record<string, string> = {
  novel: "📖", novella: "📓", short_story: "✍️", miniature: "📝",
  poetry: "📜", drama: "🎭", song: "🎶", article: "📰",
  news: "📡", essay: "📋", fairy_tale: "🧙", biography: "👤",
  correspondence: "✉️",
}

function readingTime(bodyLength: number): string {
  const min = Math.max(1, Math.round(bodyLength / 1000))
  return `~${min} min čitenja`
}

function pageEstimate(bodyLength: number): string {
  const pages = Math.max(1, Math.ceil(bodyLength / 1800))
  return `~${pages} str.`
}

export default async function LibraryReadingPage({ params }: PageProps) {
  const { slug } = await params
  const t = await getTranslations("library");
  const entry = await db.libraryEntry.findUnique({
    where: { slug },
    include: {
      parent: { select: { slug: true, title: true } },
      children: { select: { slug: true, title: true, author: true, summary: true, genre: true } },
    },
  })
  if (!entry) notFound()

  await db.libraryEntry.update({
    where: { slug },
    data: { views: { increment: 1 } },
  })

  const children = entry.children || []
  const bodyLength = entry.bodyLength || 0
  const isCollection = children.length > 0
  const childAuthors = [
    ...new Set(children.map(c => c.author).filter(Boolean) as string[]),
  ]
  const displayAuthor = entry.author || (childAuthors.length > 0
    ? childAuthors.slice(0, 3).join(", ") + (childAuthors.length > 3 ? " i drugi" : "")
    : "Neznany autor")

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link
            href="/library"
            className="hover:text-foreground transition-colors"
          >
            {t("backLink")}
          </Link>
          {entry.parent && (
            <>
              <span>/</span>
              <Link
                href={`/library/${entry.parent.slug}`}
                className="hover:text-foreground transition-colors"
              >
                {entry.parent.title}
              </Link>
            </>
          )}
        </div>

        {entry.coverImage && (
          <div className="mb-4 rounded-lg overflow-hidden">
            <img
              src={entry.coverImage}
              alt=""
              className="w-full object-cover"
              style={{ maxHeight: 320 }}
            />
          </div>
        )}

        {entry.audioFile && (
          <div className="mb-4">
            <audio controls src={entry.audioFile} className="w-full" style={{ height: 44 }}>
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        <article className="space-y-6">
          <header className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>{genreIcons[entry.genre] || "📄"} {genreLabels[entry.genre] || entry.genre}</span>
              {isCollection && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Sbornik</span>}
              {entry.topic && topicLabels[entry.topic] && (
                <>
                  <span>·</span>
                  <span>{topicLabels[entry.topic]}</span>
                </>
              )}
              <span>·</span>
              <span>{getFlavorLabel(entry.flavor)}</span>
              <span>·</span>
              <span>{displayAuthor}</span>
              {entry.translator && (
                <>
                  <span>·</span>
                  <span>{t("translated")}: {entry.translator}</span>
                </>
              )}
              <span>·</span>
              <span>{t("readingTime", { min: Math.max(1, Math.round(bodyLength / 1000)) })}</span>
              <span>·</span>
              <span>{t("pages", { n: Math.max(1, Math.ceil(bodyLength / 1800)) })}</span>
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
              {entry.body && (
                <>
                  <span className="hidden md:inline">·</span>
                  <a
                    href={`/api/library/${slug}/download`}
                    download
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border border-muted-foreground/20 hover:bg-muted/50 hover:border-foreground/40 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                    </svg>
                    {t("download")}
                  </a>
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
              <MarkdownRenderer content={decompressBody(entry.body)} />
            </div>
          ) : !isCollection ? (
            <p className="text-muted-foreground italic">{t("emptyBody")}</p>
          ) : null}

          {children.length > 0 && (
            <section className="border-t pt-6">
              <h2 className="text-lg font-bold mb-4">Sodržanije</h2>
              <ul className="space-y-2">
                {children.map(child => (
                  <li key={child.slug}>
                    <Link
                      href={`/library/${child.slug}`}
                      className="block p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                    >
                      <span className="font-medium text-sm">{child.title}</span>
                      {child.author && (
                        <span className="text-xs text-muted-foreground ml-2">— {child.author}</span>
                      )}
                      {child.summary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{child.summary}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </div>
    </div>
  )
}