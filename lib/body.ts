import { gzipSync, gunzipSync } from "zlib"

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

export function isCompressed(body: string): boolean {
  return body.startsWith("H4s")
}

export interface Chapter {
  heading: string
  content: string
}

export function splitIntoChapters(body: string): Chapter[] {
  const parts = body.split(/^## /m)
  if (parts.length <= 1) return [{ heading: "", content: body }]
  const chapters: Chapter[] = []
  if (parts[0].trim()) chapters.push({ heading: "", content: parts[0].trim() })
  for (let i = 1; i < parts.length; i++) {
    const idx = parts[i].indexOf("\n")
    if (idx === -1) {
      chapters.push({ heading: parts[i].trim(), content: "" })
    } else {
      chapters.push({ heading: parts[i].slice(0, idx).trim(), content: parts[i].slice(idx + 1).trim() })
    }
  }
  return chapters
}

export function joinChapters(chapters: Chapter[]): string {
  return chapters
    .map(ch => {
      if (ch.heading) return `## ${ch.heading}\n\n${ch.content}`
      return ch.content
    })
    .filter(Boolean)
    .join("\n\n")
}