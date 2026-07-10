import {init} from "@/lib/sqlite";

const getLang = async (lang: string, wordId: string) => {
  const db = await init();

  const data = db.prepare(`select * from ${lang} where wordId = ?`).all(wordId);

  return data;
}

export const getItem = async (id: string) => {
  const db = await init();

  const data = db.prepare('select * from lexemes where id = ?').get(id) as any;

  const allophones = db.prepare(`
    SELECT la.value, af.code AS flavorCode, la.type
    FROM lexeme_allophones la
    JOIN allophone_flavors af ON af.id = la.flavorId
    WHERE la.lexemeId = ?
  `).all(id) as { value: string; flavorCode: string; type: string }[];

  const isv = allophones.find(a => a.flavorCode === 'CORE' && a.type === 'standard')?.value;
  const nsl = allophones.find(a => a.flavorCode === 'NSL' && a.type === 'standard')?.value;

  const roots = db.prepare(`
    select * from morphemes where id IN (select morphemeId from lexemes_morphemes where lexemeId = ?)
  `).all(id);

  const meanings = db.prepare('select * from meanings where lexemeId = ?').all(id) as any[];

  const meaningIds = meanings.map(m => m.id);

  let synonymsByMeaning: Record<number, any[]> = {};
  let antonymsByMeaning: Record<number, any[]> = {};

  if (meaningIds.length > 0) {
    const placeholders = meaningIds.map(() => '?').join(',');

    const synonymRows = db.prepare(`
      SELECT s.sourceId as sourceMeaningId, s.targetId as targetMeaningId,
             m.meaning as targetMeaning, w.value as targetWord, w.id as targetWordId
      FROM synonyms s
      JOIN meanings m ON m.id = s.targetId
      JOIN lexemes w ON w.id = m.lexemeId
      WHERE s.sourceId IN (${placeholders})
    `).all(...meaningIds) as any[];

    for (const row of synonymRows) {
      if (!synonymsByMeaning[row.sourceMeaningId]) synonymsByMeaning[row.sourceMeaningId] = [];
      synonymsByMeaning[row.sourceMeaningId].push(row);
    }

    const antonymRows = db.prepare(`
      SELECT a.sourceId as sourceMeaningId, a.targetId as targetMeaningId,
             m.meaning as targetMeaning, w.value as targetWord, w.id as targetWordId
      FROM antonyms a
      JOIN meanings m ON m.id = a.targetId
      JOIN lexemes w ON w.id = m.lexemeId
      WHERE a.sourceId IN (${placeholders})
    `).all(...meaningIds) as any[];

    for (const row of antonymRows) {
      if (!antonymsByMeaning[row.sourceMeaningId]) antonymsByMeaning[row.sourceMeaningId] = [];
      antonymsByMeaning[row.sourceMeaningId].push(row);
    }
  }

  const meaningsWithRelations = meanings.map(m => ({
    ...m,
    synonyms: synonymsByMeaning[m.id] || [],
    antonyms: antonymsByMeaning[m.id] || [],
  }));

  const ru = await getLang("ru", id);
  const en = await getLang("en", id);
  const uk = await getLang("uk", id);
  const be = await getLang("be", id);
  const bg = await getLang("bg", id);
  const sr = await getLang("sr", id);
  const mk = await getLang("mk", id);
  const hr = await getLang("hr", id);
  const sl = await getLang("sl", id);
  const pl = await getLang("pl", id);
  const cs = await getLang("cs", id);
  const sk = await getLang("sk", id);
  const de = await getLang("de", id);
  const nl = await getLang("nl", id);
  const eo = await getLang("eo", id);
  const cu = await getLang("cu", id);
  const hsb = await getLang("hsb", id);
  const dsb = await getLang("dsb", id);

  return {
    ...data,
    isv,
    nsl,
    allophones,
    meanings: meaningsWithRelations,
    en,
    ru,
    uk,
    be,
    bg,
    sr,
    hr,
    mk,
    sl,
    pl,
    cs,
    sk,
    de,
    nl,
    eo,
    cu,
    hsb,
    dsb,
    roots,
  };
};