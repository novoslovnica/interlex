import { MorphemeType } from "../common/morpheme"
import { cyrillicToLatin, toStandardLatin } from "@/lib/orthography/standard"

export const RELATIVE_ADJECTIVE_SUFFIXES = ["ov", "ev", "sk"] as const
export type RelativeAdjectiveSuffix = typeof RELATIVE_ADJECTIVE_SUFFIXES[number]

export function classifyAdjectiveType(
    morphemes?: readonly { value: string | null; type?: number | null }[] | null,
): "qualitative" | "relative" {
    const hasRelativeSuffix = morphemes?.some(({ value, type }) => {
        if (type !== MorphemeType.SUFFIX || value == null) return false
        const suffix = toStandardLatin(cyrillicToLatin(value.trim().toLowerCase())).replace(/^-|-$/g, "")
        return RELATIVE_ADJECTIVE_SUFFIXES.some((marker) => marker === suffix)
    })
    return hasRelativeSuffix ? "relative" : "qualitative"
}
