import ReactMarkdown from "react-markdown"
import { rehypeReadingWords } from "./readingMarkup"
import type { ReadingLevel, ReadingWordLevels } from "@/lib/library/readingLevels"

function sanitize(content: string): string {
  return content.replace(/<script[\s\S]*?<\/script>/gi, "")
}

export function MarkdownRenderer({ content, dialogId, levels, threshold }: { content: string; dialogId?: string; levels?: ReadingWordLevels; threshold?: ReadingLevel }) {
  return <ReactMarkdown rehypePlugins={dialogId ? [[rehypeReadingWords, { dialogId, levels, threshold }]] : undefined}>{sanitize(content)}</ReactMarkdown>
}
