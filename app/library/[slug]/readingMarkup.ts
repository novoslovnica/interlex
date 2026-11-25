import type { Element, ElementContent, Root } from "hast"
import { NON_TEXT_SPANS, TOKEN_PATTERN } from "@/lib/corpus/tokenizer/patterns"
import { READING_WORD_PATTERN } from "@/lib/library/readingWord"
import { highlightLevel, type ReadingLevel, type ReadingWordLevels } from "@/lib/library/readingLevels"

const skipTags = new Set(["a", "button", "code", "pre", "script", "style", "textarea", "svg"])

export function rehypeReadingWords(options: { dialogId: string; levels?: ReadingWordLevels; threshold?: ReadingLevel }) {
    return (tree: Root) => {
        let first = true
        function wrap(parent: Root | Element) {
            for (let i = 0; i < parent.children.length; i++) {
                const child = parent.children[i]
                if (child.type === "element" && !skipTags.has(child.tagName)) {
                    wrap(child)
                }
                if (child.type !== "text") continue

                const pieces: ElementContent[] = []
                let from = 0
                let protectedIndex = 0
                const protectedSpans = [...child.value.matchAll(NON_TEXT_SPANS)]
                for (const match of child.value.matchAll(TOKEN_PATTERN)) {
                    const word = match[0]
                    const index = match.index
                    while (protectedIndex < protectedSpans.length &&
                           index >= protectedSpans[protectedIndex].index + protectedSpans[protectedIndex][0].length) {
                        protectedIndex++
                    }
                    const protectedSpan = protectedSpans[protectedIndex]
                    if (protectedSpan && index >= protectedSpan.index) continue
                    if (!READING_WORD_PATTERN.test(word.normalize("NFC"))) continue
                    if (index > from) pieces.push({ type: "text", value: child.value.slice(from, index) })
                    const level = options.levels && highlightLevel(word, options.levels, options.threshold)
                    pieces.push({
                        type: "element",
                        tagName: "button",
                        properties: {
                            type: "button",
                            dataReadingWord: word,
                            tabIndex: first ? 0 : -1,
                            ariaHasPopup: "dialog",
                            ariaControls: options.dialogId,
                            ...(level ? { ariaLabel: `${word} (${level})`, dataDifficulty: level } : {}),
                            className: [
                                "inline cursor-pointer rounded-sm underline decoration-dotted underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary",
                                ...(level ? ["bg-amber-200 text-slate-950 decoration-double dark:bg-amber-900 dark:text-amber-50"] : []),
                            ],
                        },
                        children: [{ type: "text", value: word }],
                    })
                    first = false
                    from = index + word.length
                }
                if (!pieces.length) continue
                if (from < child.value.length) pieces.push({ type: "text", value: child.value.slice(from) })
                parent.children.splice(i, 1, ...pieces)
                i += pieces.length - 1
            }
        }
        wrap(tree)
    }
}
