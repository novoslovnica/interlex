import { Case, NumberType } from './endingsRegistry';

const UD_CASE: Record<Case, string> = {
  nominative: 'Nom',
  accusative: 'Acc',
  genitive: 'Gen',
  dative: 'Dat',
  instrumental: 'Ins',
  locative: 'Loc',
  vocative: 'Voc',
};

const CASE_FROM_UD: Record<string, Case> = {
  Nom: 'nominative',
  Acc: 'accusative',
  Gen: 'genitive',
  Dat: 'dative',
  Ins: 'instrumental',
  Loc: 'locative',
  Voc: 'vocative',
};

const UD_NUMBER: Record<NumberType, string> = {
  singular: 'Sing',
  plural: 'Plur',
  dual: 'Dual',
};

const NUMBER_FROM_UD: Record<string, NumberType> = {
  Sing: 'singular',
  Plur: 'plural',
  Dual: 'dual',
};

export const UD_GENDER = {
  masculine: 'Masc',
  feminine: 'Fem',
  neuter: 'Neut',
} as const;

export const UD_ANIMACY = {
  animate: 'Anim',
  inanimate: 'Inan',
} as const;

export type Grammeme = string;

export function buildGrammeme(c: Case, n: NumberType, gender?: string, animacy?: string): string {
  const parts: string[] = [
    `Case=${UD_CASE[c]}`,
    `Number=${UD_NUMBER[n]}`,
  ];
  if (gender) parts.push(`Gender=${UD_GENDER[gender as keyof typeof UD_GENDER] ?? gender}`);
  if (animacy) parts.push(`Animacy=${UD_ANIMACY[animacy as keyof typeof UD_ANIMACY] ?? animacy}`);
  return parts.join('|');
}

export function parseGrammeme(g: Grammeme): { case: Case; number: NumberType } {
  const feats = Object.fromEntries(
    g.split('|').map(p => p.split('='))
  );
  const caseUD = feats['Case'];
  const numUD = feats['Number'];
  return {
    case: CASE_FROM_UD[caseUD] || 'nominative',
    number: NUMBER_FROM_UD[numUD] || 'singular',
  };
}