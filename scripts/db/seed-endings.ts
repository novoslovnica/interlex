import dotenv from "dotenv";
import path from "path";
import { init } from "@/lib/sqlite";
import { SLAVIC_ENDINGS_REGISTRY, StemType } from "@/lib/grammar/endingsRegistry";
import type { Case, NumberType } from "@/lib/grammar/endingsRegistry";
import { buildGrammeme } from "@/lib/grammar/grammemes";
import { ADJECTIVE_ENDINGS_REGISTRY, AdjStemType } from "@/lib/grammar/adjective";
import { GrammaticalGender } from "@/lib/grammar/common";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

// === Noun stem types (already present) ===
const NOUN_STEM_TYPES: StemType[] = ['o_hard', 'o_soft', 'a_hard', 'a_soft', 'u_basis', 'i_basis', 'consonant_n', 'consonant_s', 'consonant_ent', 'consonant_er'];
const NUMBERS: NumberType[] = ['singular', 'plural', 'dual'];
const CASES: Case[] = ['nom', 'acc', 'gen', 'dat', 'ins', 'loc', 'voc'];

const FEMININE_OVERRIDES: Record<string, Record<string, string>> = {
  a_hard: {
    'Case=Nom|Number=Sing|Gender=Fem': 'a',
    'Case=Acc|Number=Sing|Gender=Fem': 'ų',
    'Case=Gen|Number=Sing|Gender=Fem': 'y',
    'Case=Dat|Number=Sing|Gender=Fem': 'ě',
    'Case=Ins|Number=Sing|Gender=Fem': 'ojų',
    'Case=Nom|Number=Plur|Gender=Fem': 'y',
    'Case=Acc|Number=Plur|Gender=Fem': 'y',
    'Case=Dat|Number=Plur|Gender=Fem': 'am',
    'Case=Ins|Number=Plur|Gender=Fem': 'ami',
    'Case=Loc|Number=Plur|Gender=Fem': 'ah',
    'Case=Voc|Number=Plur|Gender=Fem': 'y',
    'Case=Dat|Number=Dual|Gender=Fem': 'ama',
    'Case=Ins|Number=Dual|Gender=Fem': 'ama',
  },
  a_soft: {
    'Case=Nom|Number=Sing|Gender=Fem': 'a',
    'Case=Acc|Number=Sing|Gender=Fem': 'ų',
    'Case=Gen|Number=Sing|Gender=Fem': 'ę',
    'Case=Dat|Number=Sing|Gender=Fem': 'i',
    'Case=Ins|Number=Sing|Gender=Fem': 'ejų',
    'Case=Loc|Number=Sing|Gender=Fem': 'i',
    'Case=Voc|Number=Sing|Gender=Fem': 'e',
    'Case=Nom|Number=Plur|Gender=Fem': 'ę',
    'Case=Acc|Number=Plur|Gender=Fem': 'ę',
    'Case=Dat|Number=Plur|Gender=Fem': 'am',
    'Case=Ins|Number=Plur|Gender=Fem': 'ami',
    'Case=Loc|Number=Plur|Gender=Fem': 'ah',
    'Case=Voc|Number=Plur|Gender=Fem': 'ę',
    'Case=Dat|Number=Dual|Gender=Fem': 'ama',
    'Case=Ins|Number=Dual|Gender=Fem': 'ama',
  },
};

const ANIMATE_OVERRIDES: Record<string, Record<string, string>> = {
  o_hard: { 'Case=Acc|Number=Sing|Gender=Masc|Animacy=Anim': 'a' },
  o_soft: { 'Case=Acc|Number=Sing|Gender=Masc|Animacy=Anim': 'a' },
};

// === Verb endings ===
type VerbPersonNumber = '1sg' | '2sg' | '3sg' | '1du' | '2du' | '3du' | '1pl' | '2pl' | '3pl';

const verbPersonToGrammeme: Record<VerbPersonNumber, string> = {
  '1sg': 'Person=1|Number=Sing', '2sg': 'Person=2|Number=Sing', '3sg': 'Person=3|Number=Sing',
  '1du': 'Person=1|Number=Dual', '2du': 'Person=2|Number=Dual', '3du': 'Person=3|Number=Dual',
  '1pl': 'Person=1|Number=Plur', '2pl': 'Person=2|Number=Plur', '3pl': 'Person=3|Number=Plur',
};

const VERB_PRESENT_ENDINGS: Record<string, Record<VerbPersonNumber, string>> = {
  thematic_e: {
    '1sg': 'ų', '2sg': 'š', '3sg': '',
    '1du': 'vě', '2du': 'ta', '3du': 'ta',
    '1pl': 'mo', '2pl': 'te', '3pl': 'ųt',
  },
  athematic_i: {
    '1sg': 'ų', '2sg': 'š', '3sg': '',
    '1du': 'vě', '2du': 'ta', '3du': 'ta',
    '1pl': 'mo', '2pl': 'te', '3pl': 'ęt',
  },
  // Третий класс настоящего времени: краткая парадигма глаголов на -ati
  // ("znati" -> znam/znaš/zna/znamo/znate/znajut), существующая в ISV
  // параллельно тематической ("znajų/znaješ/znaje"). Подтверждено
  // мейнтейнером 2026-08-24: её берут все глаголы на -ati, поэтому признака
  // у лексемы не заводим — обе парадигмы порождаются вместе
  // (см. conjugateFullVerb в lib/grammar/verb/index.ts).
  //
  // Граммемы те же, что у двух других классов: класс живёт в stemType, а не
  // в строке граммемы.
  athematic_a: {
    '1sg': 'm', '2sg': 'š', '3sg': '',
    '1du': 'vě', '2du': 'ta', '3du': 'ta',
    '1pl': 'mo', '2pl': 'te', '3pl': 'jut',
  },
};

const VERB_AORIST_SIGMATIC: Record<VerbPersonNumber, string> = {
  '1sg': 'h', '2sg': '', '3sg': '',
  '1du': 'hvě', '2du': 'sta', '3du': 'sta',
  '1pl': 'hmo', '2pl': 'ste', '3pl': 'šę',
};

const VERB_AORIST_ASIGMATIC: Record<VerbPersonNumber, string> = {
  '1sg': 'h', '2sg': 'e', '3sg': 'e',
  '1du': 'hvě', '2du': 'sta', '3du': 'sta',
  '1pl': 'hmo', '2pl': 'ste', '3pl': 'šę',
};

const VERB_IMPERFECT_ENDINGS: Record<VerbPersonNumber, string> = {
  '1sg': 'ah', '2sg': 'aše', '3sg': 'aše',
  '1du': 'ahvě', '2du': 'ašeta', '3du': 'ašeta',
  '1pl': 'ahmo', '2pl': 'ašete', '3pl': 'ahu',
};

const VERB_IMPERATIVE_ENDINGS: Partial<Record<VerbPersonNumber, string>> = {
  '2sg': 'i',
  '1du': 'vě', '2du': 'ta',
  '1pl': 'mo', '2pl': 'te',
};

const VERB_LPART_ENDINGS: Record<string, string> = {
  'Gender=Masc|Number=Sing|Tense=Past|VerbForm=Part': 'l',
  'Gender=Fem|Number=Sing|Tense=Past|VerbForm=Part': 'la',
  'Gender=Neut|Number=Sing|Tense=Past|VerbForm=Part': 'lo',
  'Gender=Masc|Number=Plur|Tense=Past|VerbForm=Part': 'li',
  'Gender=Fem|Number=Plur|Tense=Past|VerbForm=Part': 'le',
  'Gender=Masc|Number=Dual|Tense=Past|VerbForm=Part': 'la',
  'Gender=Fem|Number=Dual|Tense=Past|VerbForm=Part': 'lě',
};

async function seedEndings() {
  const db = await init();

  const insertEnding = db.prepare(
    `INSERT INTO ending_allophones (stemType, grammeme, value, flavorId)
     VALUES (?, ?, ?, (SELECT id FROM allophone_flavors WHERE code = 'CORE'))
     ON CONFLICT(stemType, grammeme, flavorId) DO UPDATE SET value = excluded.value`
  );

  let count = 0;

  // === 1. Noun stem types (existing) ===
  for (const stemType of NOUN_STEM_TYPES) {
    for (const number of NUMBERS) {
      for (const c of CASES) {
        const grammeme = buildGrammeme(c, number);
        const value = SLAVIC_ENDINGS_REGISTRY[stemType][number][c];
        insertEnding.run(stemType, grammeme, value);
        count++;
      }
    }
  }

  // Feminine overrides
  for (const [stemType, overrides] of Object.entries(FEMININE_OVERRIDES)) {
    for (const [grammeme, value] of Object.entries(overrides)) {
      insertEnding.run(stemType, grammeme, value);
      count++;
    }
  }

  // Animate overrides
  for (const [stemType, overrides] of Object.entries(ANIMATE_OVERRIDES)) {
    for (const [grammeme, value] of Object.entries(overrides)) {
      insertEnding.run(stemType, grammeme, value);
      count++;
    }
  }

  // === 2. Adjective endings ===
  const adjStemTypes: AdjStemType[] = ['adj_hard', 'adj_soft'];
  const adjNumbers: NumberType[] = ['singular', 'plural', 'dual'];
  const adjGenders = Object.values(GrammaticalGender);

  for (const stemType of adjStemTypes) {
    for (const number of adjNumbers) {
      for (const gender of adjGenders) {
        for (const c of CASES) {
          const genderKey = gender === GrammaticalGender.MASC ? 'Masc' : gender === GrammaticalGender.FEM ? 'Fem' : 'Neut';
          const grammeme = buildGrammeme(c, number, genderKey);
          const value = ADJECTIVE_ENDINGS_REGISTRY[stemType][number][gender][c];
          insertEnding.run(stemType, grammeme, value);
          count++;
        }
      }
    }
  }

  // === 3. Verb Present endings ===
  for (const [subtype, endings] of Object.entries(VERB_PRESENT_ENDINGS)) {
    const stemType = `verb_present_${subtype}`;
    for (const [key, value] of Object.entries(endings) as [VerbPersonNumber, string][]) {
      const grammeme = `${verbPersonToGrammeme[key]}|Tense=Pres|VerbForm=Fin`;
      insertEnding.run(stemType, grammeme, value);
      count++;
    }
  }

  // === 4. Verb Aorist endings ===
  for (const [subtype, endings] of Object.entries({ sigmatic: VERB_AORIST_SIGMATIC, asigmatic: VERB_AORIST_ASIGMATIC })) {
    const stemType = `verb_aorist_${subtype}`;
    for (const [key, value] of Object.entries(endings) as [VerbPersonNumber, string][]) {
      const grammeme = `${verbPersonToGrammeme[key]}|Tense=Aor|VerbForm=Fin`;
      insertEnding.run(stemType, grammeme, value);
      count++;
    }
  }

  // === 5. Verb Imperfect endings ===
  for (const [key, value] of Object.entries(VERB_IMPERFECT_ENDINGS) as [VerbPersonNumber, string][]) {
    const grammeme = `${verbPersonToGrammeme[key]}|Tense=Impf|VerbForm=Fin`;
    insertEnding.run('verb_imperfect', grammeme, value);
    count++;
  }

  // === 6. Verb Imperative endings ===
  for (const [key, value] of Object.entries(VERB_IMPERATIVE_ENDINGS) as [VerbPersonNumber, string][]) {
    const grammeme = `${verbPersonToGrammeme[key]}|Mood=Imp|VerbForm=Fin`;
    insertEnding.run('verb_imperative', grammeme, value);
    count++;
  }

  // === 7. Verb L-Participle endings ===
  for (const [grammeme, value] of Object.entries(VERB_LPART_ENDINGS)) {
    insertEnding.run('verb_lpart', grammeme, value);
    count++;
  }

  // === 8. Verb Present Active Participle endings ===
  const PRES_ACT_PART = {
    'Gender=Masc|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Act': 'ęťi',
    'Gender=Fem|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Act': 'ęťa',
    'Gender=Neut|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Act': 'ęťe',
    'Gender=Masc|Number=Plur|VerbForm=Part|Tense=Pres|Voice=Act': 'ęťi',
  };
  const PRES_ACT_PART_TH = {
    'Gender=Masc|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Act': 'ųšti',
    'Gender=Fem|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Act': 'ųťa',
    'Gender=Neut|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Act': 'ųťe',
    'Gender=Masc|Number=Plur|VerbForm=Part|Tense=Pres|Voice=Act': 'ųťi',
  };

  for (const [grammeme, value] of Object.entries(PRES_ACT_PART)) {
    insertEnding.run('verb_part_act_pres_i', grammeme, value);
    count++;
  }
  for (const [grammeme, value] of Object.entries(PRES_ACT_PART_TH)) {
    insertEnding.run('verb_part_act_pres_th', grammeme, value);
    count++;
  }

  // === 9. Verb Present Passive Participle endings ===
  const PRES_PASS_PART_I = {
    'Gender=Masc|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Pass': 'imyj',
    'Gender=Fem|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Pass': 'ima',
    'Gender=Neut|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Pass': 'imo',
    'Gender=Masc|Number=Plur|VerbForm=Part|Tense=Pres|Voice=Pass': 'ime',
  };
  const PRES_PASS_PART_TH = {
    'Gender=Masc|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Pass': 'omyj',
    'Gender=Fem|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Pass': 'oma',
    'Gender=Neut|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Pass': 'omo',
    'Gender=Masc|Number=Plur|VerbForm=Part|Tense=Pres|Voice=Pass': 'ome',
  };
  const PRES_PASS_PART_E = {
    'Gender=Masc|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Pass': 'emyj',
    'Gender=Fem|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Pass': 'ema',
    'Gender=Neut|Number=Sing|VerbForm=Part|Tense=Pres|Voice=Pass': 'emo',
    'Gender=Masc|Number=Plur|VerbForm=Part|Tense=Pres|Voice=Pass': 'eme',
  };

  for (const [grammeme, value] of Object.entries(PRES_PASS_PART_I)) {
    insertEnding.run('verb_part_pass_pres_i', grammeme, value);
    count++;
  }
  for (const [grammeme, value] of Object.entries(PRES_PASS_PART_TH)) {
    insertEnding.run('verb_part_pass_pres_th', grammeme, value);
    count++;
  }
  for (const [grammeme, value] of Object.entries(PRES_PASS_PART_E)) {
    insertEnding.run('verb_part_pass_pres_e', grammeme, value);
    count++;
  }

  // === 10. Verb Past Passive Participle endings ===
  const PAST_PASS_PART_EN: Record<string, string> = {
    'Gender=Masc|Number=Sing|VerbForm=Part|Tense=Past|Voice=Pass': 'enyj',
    'Gender=Fem|Number=Sing|VerbForm=Part|Tense=Past|Voice=Pass': 'ena',
    'Gender=Neut|Number=Sing|VerbForm=Part|Tense=Past|Voice=Pass': 'eno',
    'Gender=Masc|Number=Plur|VerbForm=Part|Tense=Past|Voice=Pass': 'ene',
  };
  const PAST_PASS_PART_N: Record<string, string> = {
    'Gender=Masc|Number=Sing|VerbForm=Part|Tense=Past|Voice=Pass': 'nyj',
    'Gender=Fem|Number=Sing|VerbForm=Part|Tense=Past|Voice=Pass': 'na',
    'Gender=Neut|Number=Sing|VerbForm=Part|Tense=Past|Voice=Pass': 'no',
    'Gender=Masc|Number=Plur|VerbForm=Part|Tense=Past|Voice=Pass': 'ne',
  };
  const PAST_PASS_PART_T: Record<string, string> = {
    'Gender=Masc|Number=Sing|VerbForm=Part|Tense=Past|Voice=Pass': 'tyj',
    'Gender=Fem|Number=Sing|VerbForm=Part|Tense=Past|Voice=Pass': 'ta',
    'Gender=Neut|Number=Sing|VerbForm=Part|Tense=Past|Voice=Pass': 'to',
    'Gender=Masc|Number=Plur|VerbForm=Part|Tense=Past|Voice=Pass': 'te',
  };

  for (const [grammeme, value] of Object.entries(PAST_PASS_PART_EN)) {
    insertEnding.run('verb_part_pass_past_en', grammeme, value);
    count++;
  }
  for (const [grammeme, value] of Object.entries(PAST_PASS_PART_N)) {
    insertEnding.run('verb_part_pass_past_n', grammeme, value);
    count++;
  }
  for (const [grammeme, value] of Object.entries(PAST_PASS_PART_T)) {
    insertEnding.run('verb_part_pass_past_t', grammeme, value);
    count++;
  }

  // === 11. Numeral "dva" endings ===
  const NUMERAL_TWO_ENDINGS: Record<string, string> = {
    'Case=Nom|Number=Dual': 'a',
    'Case=Acc|Number=Dual': 'a',
    'Case=Gen|Number=Dual': 'oju',
    'Case=Dat|Number=Dual': 'yma',
    'Case=Ins|Number=Dual': 'yma',
    'Case=Loc|Number=Dual': 'oju',
    'Case=Voc|Number=Dual': 'a',
  };
  for (const [g, v] of Object.entries(NUMERAL_TWO_ENDINGS)) {
    insertEnding.run('numeral_two', g, v);
    count++;
  }

  // === 12. Numeral "tri" / "četyre" endings ===
  // Gen/Dat/Ins/Loc plural historically share the i_basis noun ending (kostьjъ,
  // kostьmъ, kostьmi, kostьxъ) — corrected here the same way i_basis was
  // (2026-07-24, by analogy, confirmed with project maintainer): ьjъ->ej,
  // ьmъ->em, ьmi->emi, ьxъ->eh.
  const NUMERAL_THREE_FOUR_ENDINGS: Record<string, string> = {
    'Case=Nom|Number=Plur': 'e',
    'Case=Acc|Number=Plur': 'i',
    'Case=Gen|Number=Plur': 'ej',
    'Case=Dat|Number=Plur': 'em',
    'Case=Ins|Number=Plur': 'emi',
    'Case=Loc|Number=Plur': 'eh',
    'Case=Voc|Number=Plur': 'e',
  };
  for (const [g, v] of Object.entries(NUMERAL_THREE_FOUR_ENDINGS)) {
    insertEnding.run('numeral_three', g, v);
    count++;
  }
  for (const [g, v] of Object.entries(NUMERAL_THREE_FOUR_ENDINGS)) {
    insertEnding.run('numeral_four', g, v);
    count++;
  }

  // === 13. Collective numeral endings ===
  const COLLECTIVE_OJE_ENDINGS: Record<string, string> = {
    'Case=Nom|Number=Plur': 'e',
    'Case=Acc|Number=Plur': 'e',
    'Case=Gen|Number=Plur': 'ih',
    'Case=Dat|Number=Plur': 'im',
    'Case=Ins|Number=Plur': 'imi',
    'Case=Loc|Number=Plur': 'ih',
    'Case=Voc|Number=Plur': 'e',
  };
  const COLLECTIVE_ERO_ENDINGS: Record<string, string> = {
    'Case=Nom|Number=Plur': 'o',
    'Case=Acc|Number=Plur': 'o',
    'Case=Gen|Number=Plur': 'yh',
    'Case=Dat|Number=Plur': 'ym',
    'Case=Ins|Number=Plur': 'ymi',
    'Case=Loc|Number=Plur': 'yh',
    'Case=Voc|Number=Plur': 'o',
  };
  for (const [g, v] of Object.entries(COLLECTIVE_OJE_ENDINGS)) {
    insertEnding.run('collective_oje', g, v);
    count++;
  }
  for (const [g, v] of Object.entries(COLLECTIVE_ERO_ENDINGS)) {
    insertEnding.run('collective_ero', g, v);
    count++;
  }

  // === 14. Adverb degree suffixes ===
  insertEnding.run('adverb_comp', 'Degree=Cmp', 'ěje');
  count++;
  insertEnding.run('adverb_sup', 'Degree=Sup', 'naj');
  count++;

  console.log(`Seeded ${count} ending_allophones (CORE flavor)`);
  await db.close();
}

seedEndings().catch(e => {
  console.error(e);
  process.exit(1);
});