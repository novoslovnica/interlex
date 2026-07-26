import {init} from "@/lib/sqlite";
import {fetchSymmetricSemanticRelations} from "@/lib/relations";
import {fetchTranslationsForLexeme} from "@/lib/translations";

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

  const rawRoots = db.prepare(`
    select m.*, p.lemma as protoSlavicWordLemma
    from morphemes m
    left join proto_slavic_words p on p.id = m.protoSlavicWordId
    where m.id IN (select morphemeId from lexemes_morphemes where lexemeId = ?)
  `).all(id) as any[];

  const roots = rawRoots.map(r => ({
    ...r,
    protoSlavicWord: r.protoSlavicWordId != null ? { id: r.protoSlavicWordId, lemma: r.protoSlavicWordLemma } : null,
  }));

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

  const valencyFramesByMeaning: Record<number, any[]> = {};
  if (meaningIds.length > 0) {
    const placeholders = meaningIds.map(() => '?').join(',');
    const frames = db.prepare(`SELECT * FROM valency_frames WHERE meaningId IN (${placeholders}) ORDER BY sortOrder, id`).all(...meaningIds) as any[];
    const frameIds = frames.map(f => f.id);
    const argumentsByFrame: Record<number, any[]> = {};
    if (frameIds.length > 0) {
      const argPlaceholders = frameIds.map(() => '?').join(',');
      const args = db.prepare(`SELECT * FROM valency_arguments WHERE frameId IN (${argPlaceholders}) ORDER BY sortOrder, id`).all(...frameIds) as any[];
      for (const arg of args) {
        (argumentsByFrame[arg.frameId] ??= []).push(arg);
      }
    }
    for (const frame of frames) {
      (valencyFramesByMeaning[frame.meaningId] ??= []).push({
        ...frame,
        arguments: argumentsByFrame[frame.id] || [],
      });
    }
  }

  const meaningsWithRelations = meanings.map(m => ({
    ...m,
    synonyms: synonymsByMeaning[m.id] || [],
    antonyms: antonymsByMeaning[m.id] || [],
    valencyFrames: valencyFramesByMeaning[m.id] || [],
  }));

  const byLang = fetchTranslationsForLexeme(db, parseInt(id, 10));
  const emptyArr: never[] = [];
  const ru = byLang.ru ?? emptyArr;
  const en = byLang.en ?? emptyArr;
  const uk = byLang.uk ?? emptyArr;
  const be = byLang.be ?? emptyArr;
  const bg = byLang.bg ?? emptyArr;
  const sr = byLang.sr ?? emptyArr;
  const mk = byLang.mk ?? emptyArr;
  const hr = byLang.hr ?? emptyArr;
  const sl = byLang.sl ?? emptyArr;
  const pl = byLang.pl ?? emptyArr;
  const cs = byLang.cs ?? emptyArr;
  const sk = byLang.sk ?? emptyArr;
  const de = byLang.de ?? emptyArr;
  const nl = byLang.nl ?? emptyArr;
  const eo = byLang.eo ?? emptyArr;
  const cu = byLang.cu ?? emptyArr;
  const hsb = byLang.hsb ?? emptyArr;
  const dsb = byLang.dsb ?? emptyArr;

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