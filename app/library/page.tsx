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
  const t = await getTranslations("library.categories");

  const categoryMap: Record<string, { id: string; title: string; icon: string }> = {
    poem: { id: "poem", title: t("poem"), icon: "📜" },
    article: { id: "article", title: t("article"), icon: "📰" },
    book: { id: "book", title: t("book"), icon: "📖" },
    joke: { id: "joke", title: t("joke"), icon: "😂" },
    story: { id: "story", title: t("story"), icon: "✍️" },
    song: { id: "song", title: t("song"), icon: "🎶" },
    prayer: { id: "prayer", title: t("prayer"), icon: "🙏" },
    quote: { id: "quote", title: t("quote"), icon: "💬" },
    study: { id: "study", title: t("study"), icon: "🎓" },
  };

  const entries = await db.libraryEntry.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      title: true,
      author: true,
      category: true,
      summary: true,
      views: true,
      createdAt: true,
    },
  })

  const session = await auth()
  const canCreate = await checkPermission(session, Feature.LibraryManage)

  const items = entries.map(e => ({
    slug: e.slug,
    title: e.title,
    category: e.category,
    categoryMeta: categoryMap[e.category] || { id: e.category, title: e.category, icon: "📄" },
    author: e.author || "Neznany autor",
    summary: e.summary,
    views: e.views,
    date: e.createdAt.toISOString().slice(0, 10),
  }))

  const categories = [
    { id: "all", title: t("all"), icon: "📚" },
    ...Object.values(categoryMap),
  ]

  return <LibraryClient categories={categories} items={items} canCreate={canCreate} />
}