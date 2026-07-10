import dotenv from "dotenv";
import path from "path";
import { init } from "@/lib/sqlite";
import { SLAVIC_ENDINGS_REGISTRY, StemType, Case, NumberType } from "@/lib/grammar/endingsRegistry";
import { caseNumberToGrammeme } from "@/lib/grammar/grammemes";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

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
        const grammeme = caseNumberToGrammeme(c, number);
        const value = SLAVIC_ENDINGS_REGISTRY[stemType][number][c];
        insertEnding.run(stemType, grammeme, value);
        count++;
      }
    }
  }

  console.log(`Seeded ${count} ending_allophones (CORE flavor)`);
  await db.close();
}

seedEndings().catch(e => {
  console.error(e);
  process.exit(1);
});