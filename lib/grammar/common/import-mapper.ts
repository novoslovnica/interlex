import { PosType, GrammaticalGender } from './index';

export type CsvGrammarFields = {
  pos?: string;
  gender?: string;
  aspect?: string;
  transitivity?: string;
  animacy?: string;
  degree?: string;
  pronType?: string;
  numType?: string;
};

const CSV2_NOUN_GENDER: Record<string, GrammaticalGender> = {
  'f.': GrammaticalGender.FEM,
  'm.': GrammaticalGender.MASC,
  'm.anim.': GrammaticalGender.MASC,
  'n.': GrammaticalGender.NEUT,
  'f.sg.': GrammaticalGender.FEM,
  'm.sg.': GrammaticalGender.MASC,
  'n.sg.': GrammaticalGender.NEUT,
  'f.pl.': GrammaticalGender.FEM,
  'm.pl.': GrammaticalGender.MASC,
  'n.pl.': GrammaticalGender.NEUT,
  'n.indecl.': GrammaticalGender.NEUT,
  'm.indecl.': GrammaticalGender.MASC,
  'f.indecl.': GrammaticalGender.FEM,
  'm.anim.indecl.': GrammaticalGender.MASC,
  'm.anim.pl.': GrammaticalGender.MASC,
};

const CSV2_VERB_ASPECT: Record<string, string> = {
  'v.tr. ipf.': 'IPF',
  'v.tr. pf.': 'PF',
  'v.intr. ipf.': 'IPF',
  'v.intr. pf.': 'PF',
  'v.refl. ipf.': 'IPF',
  'v.refl. pf.': 'PF',
  'v.tr. ipf./pf.': 'BI',
  'v.intr. ipf./pf.': 'BI',
  'v.refl. ipf./pf.': 'BI',
  'v.ipf.': 'IPF',
  'v.pf.': 'PF',
  'v.aux. ipf.': 'IPF',
  'v.aux. pf.': 'PF',
};

const CSV2_VERB_TRANSITIVITY: Record<string, string> = {
  'v.tr. ipf.': 'TR',
  'v.tr. pf.': 'TR',
  'v.intr. ipf.': 'INTR',
  'v.intr. pf.': 'INTR',
  'v.refl. ipf.': 'REFL',
  'v.refl. pf.': 'REFL',
  'v.tr. ipf./pf.': 'TR',
  'v.intr. ipf./pf.': 'INTR',
  'v.refl. ipf./pf.': 'REFL',
};

const CSV2_NOUN_ANIMACY: Record<string, string> = {
  'm.anim.': 'ANIM',
  'm.anim.indecl.': 'ANIM',
  'm.anim.pl.': 'ANIM',
};

const CSV2_ADJ_DEGREE: Record<string, string> = {
  'adj.': 'POS',
  'adj.sup.': 'SUP',
  'adj.comp.': 'CMP',
};

const CSV2_PRONOUN_TYPE: Record<string, string> = {
  'pron.pers.': 'pers',
  'pron.poss.': 'poss',
  'pron.dem.': 'dem',
  'pron.indef.': 'indef',
  'pron.int.': 'int',
  'pron.rel.': 'rel',
  'pron.refl.': 'refl',
  'pron.rec.': 'rec',
};

const CSV2_NUMERAL_TYPE: Record<string, string> = {
  'num.card.': 'card',
  'num.ord.': 'ord',
  'num.subst.': 'subst',
  'num.fract.': 'fract',
  'num.coll.': 'coll',
  'num.diff.': 'diff',
  'num.mult.': 'mult',
};

const CSV2_PRONOUN_MAP = new Set([
  'pron.pers.',
  'pron.poss.',
  'pron.indef.',
  'pron.int.',
  'pron.dem.',
  'pron.rel.',
  'pron.refl.',
  'pron.rec.',
]);

const CSV2_NUMERAL_MAP = new Set([
  'num.card.',
  'num.ord.',
  'num.subst.',
  'num.fract.',
  'num.coll.',
  'num.diff.',
  'num.mult.',
  'num.',
]);

function isNoise(value: string): boolean {
  if (/^\(/.test(value) || /^\s+(jęsi|jemu|vam|nam|jej|jim|se\)|to\)|tože|tuto\))/.test(value)) {
    return true;
  }
  if (/^\(\+\d+\)$/.test(value)) {
    return true;
  }
  if (/^#/.test(value)) {
    return true;
  }
  if (/^["\s]/.test(value) && value.length > 1 && /\)$/.test(value)) {
    return true;
  }
  return false;
}

function mapFormat2(value: string): CsvGrammarFields {
  const v = value.trim();

  if (isNoise(value)) {
    return {};
  }

  const gender = CSV2_NOUN_GENDER[v];
  if (gender !== undefined) {
    const animacy = CSV2_NOUN_ANIMACY[v];
    return { pos: PosType.NOUN, gender, ...(animacy ? { animacy } : {}) };
  }
  if (v === 'm./f.') {
    return { pos: PosType.NOUN };
  }

  if (v in CSV2_VERB_ASPECT) {
    const isAux = v.startsWith('v.aux.');
    const transitivity = CSV2_VERB_TRANSITIVITY[v];
    return {
      pos: isAux ? PosType.AUX : PosType.VERB,
      aspect: CSV2_VERB_ASPECT[v],
      ...(transitivity ? { transitivity } : {}),
    };
  }

  if (v === 'adj.' || v === 'adj.sup.' || v === 'adj.comp.') {
    return { pos: PosType.ADJ, degree: CSV2_ADJ_DEGREE[v] };
  }

  if (v === 'adv.') {
    return { pos: PosType.ADV };
  }

  if (v === 'prep.') {
    return { pos: PosType.ADP };
  }

  if (v === 'conj.') {
    return { pos: PosType.CCONJ };
  }

  if (v === 'intj.') {
    return { pos: PosType.INTJ };
  }

  if (v === 'particle') {
    return { pos: PosType.PART };
  }

  if (v === 'phrase' || v === 'prefix' || v === 'suffix') {
    return { pos: PosType.X };
  }

  if (CSV2_PRONOUN_MAP.has(v)) {
    return { pos: PosType.PRON, pronType: CSV2_PRONOUN_TYPE[v] ?? undefined };
  }

  if (CSV2_NUMERAL_MAP.has(v)) {
    return { pos: PosType.NUM, numType: CSV2_NUMERAL_TYPE[v] ?? undefined };
  }

  return {};
}

const FORMAT1_MAP: Record<string, CsvGrammarFields> = {
  'n': { pos: PosType.NOUN },
  'nn': { pos: PosType.NOUN },
  'v': { pos: PosType.VERB },
  'adj': { pos: PosType.ADJ },
  'adk': { pos: PosType.ADJ },
  'adv': { pos: PosType.ADV },
  'g': { pos: PosType.X },
  'pron': { pos: PosType.PRON },
  'num': { pos: PosType.NUM },
  'prep': { pos: PosType.ADP },
  'phr': { pos: PosType.X },
  'part': { pos: PosType.PART },
  'int': { pos: PosType.INTJ },
  'conj': { pos: PosType.CCONJ },
  'prop': { pos: PosType.PROPN },
};

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}

function detectFormat(value: string): 'format1' | 'format2' | 'empty' {
  const v = value.trim();
  if (!v || isNumeric(v)) return 'empty';
  if (v.includes('.')) return 'format2';
  return 'format1';
}

export function csvGrammarMapper(value: string | null | undefined): CsvGrammarFields {
  if (!value) return {};

  const format = detectFormat(value);

  switch (format) {
    case 'format1':
      return FORMAT1_MAP[value.trim().toLowerCase()] ?? {};
    case 'format2':
      return mapFormat2(value);
    case 'empty':
      return {};
  }
}