import { prismaLibrary as db } from "@/lib/prisma"
import { LibraryClient } from "./LibraryClient"
import type { Metadata } from "next"
import {getTranslations} from "next-intl/server"
import { auth } from "@/auth"
import { Feature } from "@/config/features"
import { checkPermission } from "@/lib/permissions"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("library");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LibraryPage() {
  const tGenres = await getTranslations("library.genres");
  const tTopics = await getTranslations("library.topics");

  const genreMap: Record<string, { id: string; title: string; icon: string }> = {
    novel: { id: "novel", title: tGenres("novel"), icon: "📖" },
    novella: { id: "novella", title: tGenres("novella"), icon: "📓" },
    short_story: { id: "short_story", title: tGenres("short_story"), icon: "✍️" },
    miniature: { id: "miniature", title: tGenres("miniature"), icon: "📝" },
    poetry: { id: "poetry", title: tGenres("poetry"), icon: "📜" },
    drama: { id: "drama", title: tGenres("drama"), icon: "🎭" },
    song: { id: "song", title: tGenres("song"), icon: "🎶" },
    article: { id: "article", title: tGenres("article"), icon: "📰" },
    news: { id: "news", title: tGenres("news"), icon: "📡" },
    essay: { id: "essay", title: tGenres("essay"), icon: "📋" },
    fairy_tale: { id: "fairy_tale", title: tGenres("fairy_tale"), icon: "🧙" },
    biography: { id: "biography", title: tGenres("biography"), icon: "👤" },
    correspondence: { id: "correspondence", title: tGenres("correspondence"), icon: "✉️" },
  };

  const topicMap: Record<string, { id: string; title: string; icon: string }> = {
    fiction: { id: "fiction", title: tTopics("fiction"), icon: "🏛" },
    history_society: { id: "history_society", title: tTopics("history_society"), icon: "🏛️" },
    language_culture: { id: "language_culture", title: tTopics("language_culture"), icon: "🗣️" },
    folklore: { id: "folklore", title: tTopics("folklore"), icon: "🧙" },
    science_tech: { id: "science_tech", title: tTopics("science_tech"), icon: "🔬" },
    news_events: { id: "news_events", title: tTopics("news_events"), icon: "📰" },
  };

  const session = await auth()
  const canCreate = await checkPermission(session, Feature.LibraryManage)
  const isAdmin = canCreate

  const entries = await db.libraryEntry.findMany({
    orderBy: { createdAt: "desc" },
    where: isAdmin ? undefined : { isPublic: true },
    select: {
      slug: true,
      title: true,
      author: true,
      genre: true,
      topic: true,
      translator: true,
      coverImage: true,
      audioFile: true,
      summary: true,
      views: true,
      bodyLength: true,
      createdAt: true,
      isPublic: true,
      parentId: true,
      children: { select: { author: true }, take: 4 },
      _count: { select: { children: true } },
    },
  })

  const items = entries.map(e => {
    const childCount = e._count.children
    const childAuthors = [
      ...new Set(e.children.map(c => c.author).filter(Boolean) as string[]),
    ]
    const author = e.author || (childAuthors.length > 0
      ? childAuthors.slice(0, 3).join(", ") + (childAuthors.length > 3 ? " i drugi" : "")
      : "Neznany autor")

    return {
      slug: e.slug,
      title: e.title,
      genre: e.genre,
      genreMeta: genreMap[e.genre] || { id: e.genre, title: e.genre, icon: "📄" },
      topic: e.topic,
      topicMeta: e.topic ? (topicMap[e.topic] || { id: e.topic, title: e.topic, icon: "🏷️" }) : null,
      author,
      translator: e.translator,
      coverImage: e.coverImage,
      audioFile: e.audioFile,
      summary: e.summary,
      views: e.views,
      bodyLength: e.bodyLength,
      date: e.createdAt.toISOString().slice(0, 10),
      isCollection: childCount > 0,
    }
  })

  const genres = [
    { id: "all", title: tGenres("all"), icon: "📚" },
    ...Object.values(genreMap),
  ]

  const topics = [
    { id: "all", title: tTopics("all"), icon: "🏷️" },
    ...Object.values(topicMap),
  ]

  return <LibraryClient genres={genres} topics={topics} items={items} canCreate={canCreate} />
}