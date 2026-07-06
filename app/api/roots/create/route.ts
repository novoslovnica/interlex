import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session || !["ADMIN", "MODERATOR"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { value, type, actionHistory } = body

    if (!value || !value.trim()) {
      return NextResponse.json({ error: "value is required" }, { status: 400 })
    }

    const root = await db.root.create({
      data: {
        value,
        type: type !== undefined ? type : 0,
        actionHistory: actionHistory || null,
      },
    })

    return NextResponse.json(root, { status: 201 })
  } catch (error) {
    console.error("API Root CREATE Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}