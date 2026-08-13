import { prismaLibrary as db } from "@/lib/prisma"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("media")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const MEDIA_TYPE_ORDER = ["podcast", "youtube_channel", "video", "audio_track", "other"] as const
const MEDIA_TYPE_ICONS: Record<string, string> = {
  podcast: "🎙️",
  youtube_channel: "📺",
  video: "🎬",
  audio_track: "🎧",
  other: "🔗",
}

export default async function MediaPage() {
  const t = await getTranslations("media")

  const entries = await db.mediaLibraryEntry.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: "desc" },
  })

  const grouped = new Map<string, typeof entries>()
  for (const entry of entries) {
    const arr = grouped.get(entry.mediaType)
    if (arr) arr.push(entry)
    else grouped.set(entry.mediaType, [entry])
  }

  const orderedTypes = [
    ...MEDIA_TYPE_ORDER.filter((type) => grouped.has(type)),
    ...[...grouped.keys()].filter((type) => !(MEDIA_TYPE_ORDER as readonly string[]).includes(type)),
  ]

  return (
    <div className="min-h-full py-10 bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0f172a] dark:text-slate-100">
      <div className="max-w-4xl mx-auto px-4 md:px-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("description")}</p>
        </div>

        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}

        {orderedTypes.map((type) => (
          <section key={type} className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>{MEDIA_TYPE_ICONS[type] || "🔗"}</span>
              {t(`types.${type}`, { default: type })}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {grouped.get(type)!.map((entry) => (
                <a
                  key={entry.id}
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 p-4 bg-background border rounded-xl hover:border-primary transition-colors shadow-sm"
                >
                  {entry.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.thumbnailUrl}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-2xl shrink-0">
                      {MEDIA_TYPE_ICONS[type] || "🔗"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{entry.title}</div>
                    {entry.description && (
                      <div className="text-sm text-muted-foreground line-clamp-2">{entry.description}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {entry.platform && (
                        <span className="text-xs text-muted-foreground">{entry.platform}</span>
                      )}
                      {entry.language && (
                        <span className="text-xs text-muted-foreground">· {entry.language}</span>
                      )}
                      {entry.verified && (
                        <span className="text-xs text-green-600 dark:text-green-500">{t("verified")}</span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
