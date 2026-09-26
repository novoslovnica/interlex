import { prismaData } from "@/lib/prisma"
import { buildKnownPrepositions, forEachLexemeForms } from "@/lib/corpus/tokenizer/analyzer-factory"
import { cyrillicSpellings, etymologicalSpelling, latinLexemeSpellings } from "@/lib/orthography/standard"

export interface CollectedForms {
    /** Для каждой лексемы - все её написания латиницей: этимологическое
     * (каноническое, сырой вывод движка) первым, дальше стандартное и
     * принятые варианты. */
    latin: string[][]
    cyrillic: string[][]
    lexemes: number
    etymForms: number
    /** Формы, отсечённые санити-чеком (jers/ǫ/чужие знаки). */
    rejectedEtymological: number
}

// Только публичные лексемы со значением - то же множество, что видно на сайте.
// Регистр снимается у всех: строчная запись в Hunspell принимает и слово с
// заглавной, а флаг properNoun ещё не вычитан (/admin/proper-nouns), и
// требовать заглавную по нему значило бы подчёркивать правильный текст.
export async function collectHunspellForms(): Promise<CollectedForms> {
    const knownPrepositions = await buildKnownPrepositions()
    const byLexeme = new Map<number, Set<string>>()
    let etymForms = 0
    let rejectedEtymological = 0
    const rejectedExamples: string[] = []

    await forEachLexemeForms(knownPrepositions, { isPublic: true, meanings: { some: {} } }, (lexeme, forms) => {
        const set = byLexeme.get(lexeme.id) ?? new Set<string>()
        for (const f of forms) {
            // Коллокации и глаголы с хвостом ("zaviseti od") - несколько слов;
            // каждое из них проверяется отдельно и есть в словаре само по себе.
            if (/\s/.test(f.surfaceForm)) continue
            // Каноническое написание - этимологическое: движок его и порождает.
            // Формы с jers/ǫ или чужими знаками пропускаем (миграция на ų), но
            // первые 20 показываем в логе.
            const etym = etymologicalSpelling(f.surfaceForm)
            if (etym === null) {
                if (rejectedExamples.length < 20) rejectedExamples.push(f.surfaceForm)
                rejectedEtymological++
                continue
            }
            set.add(etym)
        }
        byLexeme.set(lexeme.id, set)
    })
    if (rejectedEtymological > 0) {
        console.warn(`rejected ${rejectedEtymological} non-etymological forms, first: ${rejectedExamples.join(", ")}`)
    }

    // Супплетивные формы из inflection_anomalies (jest/sųt у byti, формы
    // местоимений) движок сам не порождает.
    const anomalies = await prismaData.inflectionAnomaly.findMany({ select: { lexemeId: true, inflection: true } })
    for (const a of anomalies) {
        const set = byLexeme.get(a.lexemeId)
        if (!set) continue
        for (const part of a.inflection.split(/[\s/,]+/)) if (part) set.add(part.toLowerCase())
    }

    const latin: string[][] = []
    const cyrillic: string[][] = []
    for (const set of byLexeme.values()) {
        etymForms += set.size
        // Этимологическое как есть + конвертация в стандартное и варианты;
        // дедупликация - в buildHunspell.
        latin.push(latinLexemeSpellings(set))
        cyrillic.push([...set].flatMap(cyrillicSpellings))
    }
    return { latin, cyrillic, lexemes: byLexeme.size, etymForms, rejectedEtymological }
}
