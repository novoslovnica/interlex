import { auth } from "@/auth"
import { prismaAuth as dbAuth } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ isBookmarked: false })
  }

  const wordId = parseInt(req.nextUrl.searchParams.get("wordId") || "")
  if (!wordId) {
    return NextResponse.json({ isBookmarked: false })
  }

  const item = await dbAuth.userWordCollection.findUnique({
    where: {
      userId_wordId: { userId: session.user.id, wordId },
    },
  })

  return NextResponse.json({ isBookmarked: !!item })
}