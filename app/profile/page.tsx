import { auth } from "@/auth"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { redirect } from "next/navigation"
import ProfileContent from "./ProfileContent"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { init } from "@/lib/sqlite"
import { fetchContributorSummary } from "@/lib/community/publicStats"
import { ContributionStats } from "@/components/community/ContributionStats"

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

  const [profile, tCommunity, db] = await Promise.all([
    dbAuth.userProfile.findUnique({ where: { userId: user.id }, select: { handle: true } }),
    getTranslations("community.contribute"),
    init(),
  ])
  let summary
  try {
    summary = fetchContributorSummary(db, userId)
  } finally {
    db.close()
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
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

      <ProfileContent wordIds={wordIds} translationLang={translationLang} />
    </main>
  )
}