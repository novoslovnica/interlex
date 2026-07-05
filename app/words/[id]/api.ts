import {init} from "@/lib/sqlite";

const getLang = async (lang: string, wordId: string) => {
  const db = await init();

  const data = db.prepare(`select * from ${lang} where wordId = ?`).all(wordId);

  return data;
}

export const getItem = async (id: string) => {
  const db = await init();

  const data = db.prepare('select * from words where id = ?').get(id);

  const roots = db.prepare(`
    select * from roots where id IN (select rootId from roots_words where wordId = ?)
  `).all(id);

  const meanings = db.prepare('select * from meanings where wordId = ?').all(id);

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

  return {
    ...data,
    meanings,
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
    roots,
  };
};