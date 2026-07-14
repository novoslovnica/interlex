"use server"

import { auth } from "@/auth"
import { prismaAuth as dbAuth } from "@/lib/prisma"

export async function addWordToCollection(wordId: number) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  await dbAuth.userWordCollection.upsert({
    where: {
      userId_wordId: { userId: session.user.id, wordId },
    },
    create: {
      userId: session.user.id,
      wordId,
    },
    update: {},
  })
}

export async function removeWordFromCollection(wordId: number) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  await dbAuth.userWordCollection.deleteMany({
    where: { userId: session.user.id, wordId },
  })
}

export async function getUserCollection() {
  const session = await auth()
  if (!session?.user?.id) return []

  const items = await dbAuth.userWordCollection.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })
  return items
}

export async function isWordInCollection(wordId: number): Promise<boolean> {
  const session = await auth()
  if (!session?.user?.id) return false

  const item = await dbAuth.userWordCollection.findUnique({
    where: {
      userId_wordId: { userId: session.user.id, wordId },
    },
  })
  return !!item
}