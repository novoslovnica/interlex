import dotenv from "dotenv";
import path from "path";
import { init } from "@/lib/sqlite";
import { SLAVIC_ENDINGS_REGISTRY, StemType, Case, NumberType } from "@/lib/grammar/endingsRegistry";
import { buildGrammeme } from "@/lib/grammar/grammemes";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const FEMININE_OVERRIDES: Record<string, Record<string, string>> = {
  a_hard: {
    'Case=Nom|Number=Sing|Gender=Fem': 'a',
    'Case=Acc|Number=Sing|Gender=Fem': 'ǫ',
    'Case=Gen|Number=Sing|Gender=Fem': 'y',
    'Case=Dat|Number=Sing|Gender=Fem': 'ě',
    'Case=Ins|Number=Sing|Gender=Fem': 'ojǫ',
    'Case=Nom|Number=Plur|Gender=Fem': 'y',
    'Case=Acc|Number=Plur|Gender=Fem': 'y',
    'Case=Dat|Number=Plur|Gender=Fem': 'amъ',
    'Case=Ins|Number=Plur|Gender=Fem': 'ami',
    'Case=Loc|Number=Plur|Gender=Fem': 'ahъ',
    'Case=Voc|Number=Plur|Gender=Fem': 'y',
    'Case=Dat|Number=Dual|Gender=Fem': 'ama',
    'Case=Ins|Number=Dual|Gender=Fem': 'ama',
  },
  a_soft: {
    'Case=Nom|Number=Sing|Gender=Fem': 'a',
    'Case=Acc|Number=Sing|Gender=Fem': 'ǫ',
    'Case=Gen|Number=Sing|Gender=Fem': 'ę',
    'Case=Dat|Number=Sing|Gender=Fem': 'i',
    'Case=Ins|Number=Sing|Gender=Fem': 'ejǫ',
    'Case=Loc|Number=Sing|Gender=Fem': 'i',
    'Case=Voc|Number=Sing|Gender=Fem': 'e',
    'Case=Nom|Number=Plur|Gender=Fem': 'ę',
    'Case=Acc|Number=Plur|Gender=Fem': 'ę',
    'Case=Dat|Number=Plur|Gender=Fem': 'amъ',
    'Case=Ins|Number=Plur|Gender=Fem': 'ami',
    'Case=Loc|Number=Plur|Gender=Fem': 'ahъ',
    'Case=Voc|Number=Plur|Gender=Fem': 'ę',
    'Case=Dat|Number=Dual|Gender=Fem': 'ama',
    'Case=Ins|Number=Dual|Gender=Fem': 'ama',
  },
};

const ANIMATE_OVERRIDES: Record<string, Record<string, string>> = {
  o_hard: {
    'Case=Acc|Number=Sing|Gender=Masc|Animacy=Anim': 'a',
  },
  o_soft: {
    'Case=Acc|Number=Sing|Gender=Masc|Animacy=Anim': 'a',
  },
};

async function seedEndings() {
  const db = await init();

  const stemTypes: StemType[] = ['o_hard', 'o_soft', 'a_hard', 'a_soft', 'u_basis', 'i_basis', 'consonant_n', 'consonant_s'];
  const numbers: NumberType[] = ['singular', 'plural', 'dual'];
  const cases: Case[] = ['nominative', 'accusative', 'genitive', 'dative', 'instrumental', 'locative', 'vocative'];

  const insertEnding = db.prepare(
    `INSERT INTO ending_allophones (stemType, grammeme, value, flavorId)
     VALUES (?, ?, ?, (SELECT id FROM allophone_flavors WHERE code = 'CORE'))
     ON CONFLICT(stemType, grammeme, flavorId) DO UPDATE SET value = excluded.value`
  );

  let count = 0;

  for (const stemType of stemTypes) {
    for (const number of numbers) {
      for (const c of cases) {
        const grammeme = buildGrammeme(c, number);
        const value = SLAVIC_ENDINGS_REGISTRY[stemType][number][c];
        insertEnding.run(stemType, grammeme, value);
        count++;
      }
    }
  }

  for (const [stemType, overrides] of Object.entries(FEMININE_OVERRIDES)) {
    for (const [grammeme, value] of Object.entries(overrides)) {
      insertEnding.run(stemType, grammeme, value);
      count++;
    }
  }

  for (const [stemType, overrides] of Object.entries(ANIMATE_OVERRIDES)) {
    for (const [grammeme, value] of Object.entries(overrides)) {
      insertEnding.run(stemType, grammeme, value);
      count++;
    }
  }

  console.log(`Seeded ${count} ending_allophones (CORE flavor)`);
  await db.close();
}

seedEndings().catch(e => {
  console.error(e);
  process.exit(1);
});