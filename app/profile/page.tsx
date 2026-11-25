import { auth } from "@/auth"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { redirect } from "next/navigation"
import ProfileContent from "./ProfileContent"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { init } from "@/lib/sqlite"
import { fetchContributorSummary } from "@/lib/community/publicStats"
import { ContributionStats } from "@/components/community/ContributionStats"
import { WordNoteEditor } from "@/components/WordNoteEditor"
import { listWordNotes } from "@/lib/word-notes"
import { isvToCyr } from "@/lib/isv"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = session.user
  const userId = session.user.id
  const collections = await dbAuth.userWordCollection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  })

  const userSettings = await dbAuth.userSettings.findUnique({
    where: { userId: user.id },
  })

  const langCodes = ["en", "ru", "mk", "sr", "bg", "pl", "cs", "sl", "de", "uk", "be", "sk", "hr", "hsb", "dsb", "cu", "nl", "eo"]
  const userLang = userSettings?.language || "ru"
  const translationLang = langCodes.includes(userLang) ? userLang : "ru"

  const wordIds = collections.map(c => c.wordId)

  const [profile, tCommunity, db, notes, tNotes] = await Promise.all([
    dbAuth.userProfile.findUnique({ where: { userId: user.id }, select: { handle: true } }),
    getTranslations("community.contribute"),
    init(),
    listWordNotes(userId),
    getTranslations("wordNotes"),
  ])
  let summary
  try {
    summary = fetchContributorSummary(db, userId)
  } finally {
    db.close()
  }

  return (
    <main className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 mb-8">
        <div className="flex items-center gap-4 mb-4">
          {user.image && (
            <img
              src={user.image}
              alt={user.name || ""}
              className="w-14 h-14 rounded-full border border-gray-300"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{user.name}</h1>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          Saved words: <strong>{wordIds.length}</strong>
        </p>
      </div>

      {summary && (
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 mb-8 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{tCommunity("yourStats")}</h2>
            {profile && <Link href={`/u/${profile.handle}`} className="text-xs text-blue-600">{tCommunity("profileLink")} →</Link>}
          </div>
          <ContributionStats summary={summary} />
        </div>
      )}

      <section className="mb-8 space-y-3 rounded-2xl border bg-card p-6 text-foreground">
        <h2 id="profile-word-notes" tabIndex={-1} className="font-bold">{tNotes("collection")}</h2>
        {notes.length === 0 ? <p>{tNotes("empty")}</p> : (
          <ul className="space-y-2">
            {notes.map(note => {
              const title = note.title && userSettings?.script !== "LATIN" ? isvToCyr(note.title) : note.title
              const label = title || tNotes("missingWord", { wordId: note.wordId })
              return (
                <li key={note.wordId} className="rounded-lg border p-3">
                  <details>
                    <summary className="cursor-pointer rounded font-semibold focus-visible:outline-2 focus-visible:outline-primary">{label}</summary>
                    <div className="mt-3 space-y-2">
                      {title && <Link className="text-sm underline" href={`/words/${note.wordId}`}>{tNotes("openWord")}</Link>}
                      <WordNoteEditor wordId={note.wordId} initialBody={note.body} label={`${tNotes("personal")} — ${label}`} canSave={!!title} focusFallbackId="profile-word-notes" />
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ProfileContent wordIds={wordIds} translationLang={translationLang} />
    </main>
  )
}