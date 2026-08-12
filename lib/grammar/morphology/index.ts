// Раньше здесь было отдельное, дублирующее объявление того же интерфейса
// (case/number/gender захардкожены строковыми литералами напрямую, без
// импорта GrammaticalCase/GrammaticalNumber/GrammaticalGender) — оба
// объявления занесены одним и тем же коммитом ("inject corpus", 2026-07-03),
// который разом занёс и lib/grammar/morphology/, и lib/grammar/common/, не
// связав их. Отсюда и импортируем единственное определение — re-export ниже
// сохраняет `@/lib/grammar/morphology` как рабочий путь импорта для тех, кто
// уже так делает (processors.ts, dbAnalyzer.ts, resolveHomonymsViaSyntax.ts).
import type { MorphoGrammarFeats } from '@/lib/grammar/common';
export type { MorphoGrammarFeats };

export interface GeneratedForm {
    surfaceForm: string;
    accentedForm?: string;
    feats: MorphoGrammarFeats;
}

export interface EngineWordInput {
    id: number;
    slug: string;
    isv: string | null;
    pos: string | null;
    protoStemClass?: string | null;
    stemExtension?: string | null;
    paradigm?: string | null;
    stem?: string | null;
    secondaryStem?: string | null;
    tertiaryStem?: string | null;
    gender?: string | null;
    alternationType?: string | null;
    fleetingVowelAt?: number | null;
    flavor?: string;
    animacy?: string | null;
    stressPosition?: number | null;      // Переопределение ударения словом целиком (заимствования)
    morphemes?: { value: string; stressPosition?: number | null }[]; // Переопределение ударным суффиксом/корнем
    isCollocation?: boolean; // Многословная единица без единой парадигмы — см. Lexeme.isCollocation
    knownPrepositions?: string[]; // Однословные ADP из БД — для распознавания механического хвоста у VERB (processVerb)
}
