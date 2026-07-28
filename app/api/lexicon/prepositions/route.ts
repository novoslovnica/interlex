import { NextResponse } from "next/server"
import { prismaData } from "@/lib/prisma"

/**
 * Полный список лексем-предлогов (pos=ADP) для поля выбора предлога в
 * ArticleForm.tsx (Валентность) — заменяет свободный текстовый ввод.
 * Список небольшой (десятки строк), поэтому отдаётся целиком и
 * отсортированным по алфавиту; фильтрация по вводу — на клиенте, без
 * отдельного debounce-поиска на сервере.
 */
export async function GET() {
  const lexemes = await prismaData.lexeme.findMany({
    where: { pos: "ADP" },
    select: { id: true, slug: true, value: true },
    orderBy: { value: "asc" },
  })

  return NextResponse.json({
    prepositions: lexemes.filter((l) => !!l.value),
  })
}
