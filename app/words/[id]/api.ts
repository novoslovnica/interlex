import {init} from "@/lib/sqlite";
import {fetchSymmetricSemanticRelations} from "@/lib/relations";

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

  const word = allophones.find(a => a.flavorCode === 'CORE' && a.type === 'standard') || null;
  const isv = word?.value;
  const nsl = allophones.find(a => a.flavorCode === 'NSL' && a.type === 'standard')?.value;

  const roots = db.prepare(`
    select * from morphemes where id IN (select morphemeId from lexemes_morphemes where lexemeId = ?)
  `).all(id);

  const meanings = db.prepare('select * from meanings where lexemeId = ?').all(id) as any[];

  const meaningIds = meanings.map(m => m.id);

  let synonymsByMeaning: Record<number, any[]> = {};
  let antonymsByMeaning: Record<number, any[]> = {};

  if (meaningIds.length > 0) {
    const synonymMap = fetchSymmetricSemanticRelations(db, 'synonym', meaningIds);
    for (const [meaningId, related] of synonymMap) {
      synonymsByMeaning[meaningId] = related.map((r) => ({
        sourceMeaningId: meaningId,
        targetMeaningId: r.otherMeaningId,
        targetMeaning: r.otherMeaning,
        targetWord: r.otherWord,
        targetWordId: r.otherWordId,
      }));
    }

    const antonymMap = fetchSymmetricSemanticRelations(db, 'antonym', meaningIds);
    for (const [meaningId, related] of antonymMap) {
      antonymsByMeaning[meaningId] = related.map((r) => ({
        sourceMeaningId: meaningId,
        targetMeaningId: r.otherMeaningId,
        targetMeaning: r.otherMeaning,
        targetWord: r.otherWord,
        targetWordId: r.otherWordId,
      }));
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
    word,
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