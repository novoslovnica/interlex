import { latinToCyrillic, stripStress, toStandardLatin } from "@/lib/orthography/standard"
import { isvToCyr } from "@/lib/isv"

export function isFormAnswer(input: string, expected: string): boolean {
    const answer = stripStress(input.trim().toLowerCase())
    const standard = toStandardLatin(expected)
    return [expected, standard, isvToCyr(expected), isvToCyr(standard), latinToCyrillic(expected)].includes(answer)
}
