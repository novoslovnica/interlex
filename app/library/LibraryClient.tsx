"use client"

import { useState } from "react"
import Link from "next/link"
import {useTranslations} from "next-intl"

interface Category {
  id: string
  title: string
  icon: string
}

interface LibraryItem {
  slug: string
  title: string
  genre: string
  genreMeta: { id: string; title: string; icon: string }
  topic: string | null
  topicMeta: { id: string; title: string; icon: string } | null
  author: string
  translator: string | null
  coverImage: string | null
  audioFile: string | null
  summary: string | null
  views: number
  bodyLength: number
  date: string
  isCollection: boolean
}

interface LibraryClientProps {
  genres: Category[]
  topics: Category[]
  items: LibraryItem[]
  canCreate?: boolean
}

function readingTimeText(bodyLength: number): string {
  const min = Math.max(1, Math.round(bodyLength / 1000))
  return `~${min} min`
}

function pageEstimateText(bodyLength: number): string {
  const pages = Math.max(1, Math.ceil(bodyLength / 1800))
  return `~${pages} str.`
}

export function LibraryClient({ genres, topics, items, canCreate }: LibraryClientProps) {
  const t = useTranslations("library");
  const [selectedGenre, setSelectedGenre] = useState("all")
  const [selectedTopic, setSelectedTopic] = useState("all")
  const [selectedOrigin, setSelectedOrigin] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredItems = items.filter(item => {
    const matchesGenre = selectedGenre === "all" || item.genre === selectedGenre
    const matchesTopic = selectedTopic === "all" || item.topic === selectedTopic
    const matchesOrigin = selectedOrigin === "all" ||
      (selectedOrigin === "original" && !item.translator) ||
      (selectedOrigin === "translated" && item.translator)
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q || item.title.toLowerCase().includes(q) || item.author.toLowerCase().includes(q)
    return matchesGenre && matchesTopic && matchesOrigin && matchesSearch
  })

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden">
      <aside className="w-72 border-r flex flex-col h-full shrink-0 hidden lg:flex">
        <div className="p-5 border-b space-y-2 shrink-0">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Glavna
          </Link>
          <h2 className="font-bold text-lg">Sbornik</h2>
          <p className="text-[11px] text-muted-foreground">Biblioteka tekstov</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-3">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground px-3 mb-1 uppercase tracking-wider">Žanry</p>
            <div className="space-y-0.5">
              {genres.map(genre => (
                <button
                  key={genre.id}
                  onClick={() => setSelectedGenre(genre.id)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors text-xs flex items-center gap-2 ${
                    selectedGenre === genre.id
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="text-sm">{genre.icon}</span>
                  <span className="truncate">{genre.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium text-muted-foreground px-3 mb-1 uppercase tracking-wider">Temy</p>
            <div className="space-y-0.5">
              {topics.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopic(topic.id)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors text-xs flex items-center gap-2 ${
                    selectedTopic === topic.id
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="text-sm">{topic.icon}</span>
                  <span className="truncate">{topic.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium text-muted-foreground px-3 mb-1 uppercase tracking-wider">Pohod</p>
            <div className="space-y-0.5">
              {[
                { id: "all", title: t("originAll"), icon: "🌐" },
                { id: "original", title: t("original"), icon: "✏️" },
                { id: "translated", title: t("translated"), icon: "🔄" },
              ].map(origin => (
                <button
                  key={origin.id}
                  onClick={() => setSelectedOrigin(origin.id)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors text-xs flex items-center gap-2 ${
                    selectedOrigin === origin.id
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="text-sm">{origin.icon}</span>
                  <span className="truncate">{origin.title}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t text-[11px] text-muted-foreground space-y-2">
          <a
            href="https://isv.miraheze.org/wiki/Sbornik:Glavna_stranica"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:text-foreground transition-colors"
          >
            Vikisbornik ↗
          </a>
          <p>CC BY-SA 4.0</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="border-b px-5 py-3 shrink-0 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Iskati tekst ili autora..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 bg-muted/50 border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
            />
          </div>
          <Link
            href="/textbook"
            className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted transition-colors shrink-0"
          >
            Učebnik
          </Link>
          {canCreate && (
            <Link
              href="/admin/library/new"
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
            >
              + Dodati
            </Link>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-5 py-6 space-y-6">
            {filteredItems.length > 0 ? (
              <div className="divide-y">
                {filteredItems.map(item => (
                  <Link
                    key={item.slug}
                    href={`/library/${item.slug}`}
                    className="flex items-start gap-4 py-3 group -mx-2 px-2 rounded-md hover:bg-muted/30 transition-colors"
                  >
                    {item.coverImage ? (
                      <img
                        src={item.coverImage}
                        alt=""
                        className="w-12 h-16 shrink-0 rounded object-cover border"
                      />
                    ) : (
                      <span className="text-base mt-0.5 shrink-0">{item.genreMeta.icon}</span>
                    )}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-baseline gap-2">
                        <h3 className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                          {item.title}
                        </h3>
                        {item.isCollection && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">Sbornik</span>}
                        {item.audioFile && <span className="text-xs shrink-0" title="Audio dostupny">🎧</span>}
                        <span className="text-[11px] text-muted-foreground/60 shrink-0 font-mono">{item.date}</span>
                      </div>
                      {item.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.summary}</p>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
                        <span>{item.author}</span>
                        <span>{item.views} 👁</span>
                        <span>{readingTimeText(item.bodyLength)}</span>
                        <span>{pageEstimateText(item.bodyLength)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Teksty ne nahodili se</p>
                <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
                  {t("emptyFilter")}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}