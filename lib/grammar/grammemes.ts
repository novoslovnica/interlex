import { Case, NumberType } from './endingsRegistry';

export type Grammeme =
  | 'SgNom' | 'SgAcc' | 'SgGen' | 'SgDat' | 'SgIns' | 'SgLoc' | 'SgVoc'
  | 'PlNom' | 'PlAcc' | 'PlGen' | 'PlDat' | 'PlIns' | 'PlLoc' | 'PlVoc'
  | 'DuNom' | 'DuAcc' | 'DuGen' | 'DuDat' | 'DuIns' | 'DuLoc' | 'DuVoc';

const CASE_TO_SHORT: Record<Case, string> = {
  nominative: 'Nom',
  accusative: 'Acc',
  genitive: 'Gen',
  dative: 'Dat',
  instrumental: 'Ins',
  locative: 'Loc',
  vocative: 'Voc',
};

const SHORT_TO_CASE: Record<string, Case> = {
  Nom: 'nominative',
  Acc: 'accusative',
  Gen: 'genitive',
  Dat: 'dative',
  Ins: 'instrumental',
  Loc: 'locative',
  Voc: 'vocative',
};

const NUMBER_TO_SHORT: Record<NumberType, string> = {
  singular: 'Sg',
  plural: 'Pl',
  dual: 'Du',
};

const SHORT_TO_NUMBER: Record<string, NumberType> = {
  Sg: 'singular',
  Pl: 'plural',
  Du: 'dual',
};

export function caseNumberToGrammeme(c: Case, n: NumberType): Grammeme {
  return `${NUMBER_TO_SHORT[n]}${CASE_TO_SHORT[c]}` as Grammeme;
}

export function grammemeToCaseNumber(g: Grammeme): { case: Case; number: NumberType } {
  const numShort = g.slice(0, 2) as 'Sg' | 'Pl' | 'Du';
  const caseShort = g.slice(2) as keyof typeof SHORT_TO_CASE;
  return {
    number: SHORT_TO_NUMBER[numShort],
    case: SHORT_TO_CASE[caseShort],
  };
}

export function grammemeToCase(g: Grammeme): Case {
  const caseShort = g.slice(2) as keyof typeof SHORT_TO_CASE;
  return SHORT_TO_CASE[caseShort];
}

export function grammemeToNumber(g: Grammeme): NumberType {
  const numShort = g.slice(0, 2) as 'Sg' | 'Pl' | 'Du';
  return SHORT_TO_NUMBER[numShort];
}