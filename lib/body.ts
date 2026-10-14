import { gzipSync, gunzipSync } from "zlib"
import { isCompressed, splitIntoChapters, joinChapters } from "@/lib/library/chapters"

// zlib — Node built-in, поэтому этот модуль импортируют только серверные пути.
// Клиентскому коду (app/admin/platform/library/new/form.tsx) нужны лишь чистые
// функции ниже — они живут в lib/library/chapters.ts и реэкспортируются отсюда,
// чтобы не менять существующие импорты `@/lib/body`.
export { isCompressed, splitIntoChapters, joinChapters }
export type { Chapter } from "@/lib/library/chapters"

export function compressBody(raw: string): string {
  return gzipSync(raw).toString("base64")
}

export function decompressBody(compressed: string): string {
  try {
    return gunzipSync(Buffer.from(compressed, "base64")).toString()
  } catch {
    return compressed
  }
}
