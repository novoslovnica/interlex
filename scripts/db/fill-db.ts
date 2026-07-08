import Papa from "papaparse";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import {init} from "@/lib/sqlite";
import {mapNslToEtymologized, mapNslToStandard} from "@/lib/nsl";
import {csvGrammarMapper, generateStemCandidates, heuristicStem} from "@/lib/grammar/common";
import {buildIntelligibilityString} from "@/lib/levenshtein";
import { MainCategory } from "@/lib/enums/MainCategory";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const FIELD_TO_MAIN_CATEGORY: Record<string, MainCategory> = {
  "обчя": MainCategory.EVERYDAY_LIFE,
  "землёјопис": MainCategory.GEOGRAPHY,
  "книжность": MainCategory.CULTURE_ART,
  "најука": MainCategory.SCIENCE,
  "реліґија": MainCategory.RELIGION,
  "спорт": MainCategory.EVERYDAY_LIFE,
  "гудба": MainCategory.CULTURE_ART,
};

const file = path.resolve(process.cwd(), 'slovnik.csv');

const insertLang = (db, lang: string, wordId: bigint, meaningId: bigint, value: string) => {
   db.prepare(`insert into ${lang} (
                     value,
                     veryfied,
                     wordId,
                     meaningId,
                     updatedAt
                 ) values (?, ?, ?, ?, ?)`)
        .run(value, 0, wordId, meaningId, new Date().toISOString());
};

const insertRow = (db, roots, {
    cyr,
    lat,
    value,
    trans,
    rootId,
    decl,
    synonym,
    fieldCsv,
    meaning,
    etymology,
    pos,
    aspect,
    transitivity,
    animacy,
    degree,
    pronType,
    numType,
    intelligibility,
}: {
    cyr: string;
    lat: string;
    value: string;
    trans: string;
    rootId: string;
    decl: string;
    synonym: string;
    fieldCsv: string;
    meaning: string;
    etymology: string;
    pos?: string;
    aspect?: string;
    transitivity?: string;
    animacy?: string;
    degree?: string;
    pronType?: string;
    numType?: string;
    intelligibility?: string;
}): Promise<[bigint, bigint]> => {
    const mainCategory = FIELD_TO_MAIN_CATEGORY[fieldCsv] || null;
    const insert = db.prepare(`INSERT INTO lexemes (
        value,
        isv,
        nsl,
        transcription,
        mainCategory,
        usageType,
       declension,
       etymology,
       pos,
       aspect,
       transitivity,
       animacy,
       degree,
       pronType,
       numType,
       gender,
       conjugation,
       slug,
       stem,
       intelligibility,
       updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const check = db.prepare(`SELECT * FROM lexemes WHERE slug = ? `).get(`${lat.toLowerCase()}-${pos}`);
    const stem = heuristicStem(lat, pos).toLowerCase();

    let wId;
    if (!check) {
        const grammar = csvGrammarMapper(pos);

        const r = insert.run(
            value,
            lat,
            cyr,
            trans,
            mainCategory,
            'general',
            decl,
            etymology,
            grammar.pos,
            grammar.aspect,
            grammar.transitivity,
            grammar.animacy,
            grammar.degree,
            grammar.pronType,
            grammar.numType,
            grammar.gender,
            decl,
            `${lat.toLowerCase()}-${pos}`,
            stem,
            intelligibility || null,
            new Date().toISOString(),
        );
        wId = r.lastInsertRowid;
    } else {
        wId = check.id;
    }

    const insertMeaning = db.prepare(`INSERT INTO meanings (
        lexemeId,
        meaning,
        examples,
        updatedAt
    ) VALUES (?, ?, ?, ?)`);
    const rM = insertMeaning.run(
        wId,
        meaning || "",
        "",
        new Date().toISOString(),
    );
    const mId = rM.lastInsertRowid;

    if (stem) {
        const candidates = generateStemCandidates({
            stem,
            secondaryStem: "",
            tertiaryStem: "",
            isv: lat,
            pos,
        });
        const upsertHomonym = (base: string) => {
            const existing = db.prepare(`SELECT * FROM base_homonyms WHERE base = ?`).get(base) as { id: bigint; wordIds: string } | undefined;
            const wordIdNum = Number(wId);
            if (existing) {
                const ids: number[] = JSON.parse(existing.wordIds);
                if (!ids.includes(wordIdNum)) {
                    ids.push(wordIdNum);
                    db.prepare(`UPDATE base_homonyms SET wordIds = ? WHERE id = ?`).run(JSON.stringify(ids), existing.id);
                }
            } else {
                db.prepare(`INSERT INTO base_homonyms (base, wordIds) VALUES (?, ?)`).run(base, JSON.stringify([wordIdNum]));
            }
        };
        for (const base of candidates) {
            upsertHomonym(base);
        }
    }

    if (rootId) {
        const rId = db.prepare("select id from morphemes where value = ?")
                .get(rootId);

        db.prepare(`INSERT INTO lexemes_morphemes (
        lexemeId,
        morphemeId
    ) VALUES (?, ?)`).run(
            wId,
            rId.id,
        );
    }

    return [wId as bigint, mId as bigint];
};

const fillDb = async () => {
    const fileContent = fs.readFileSync(file, 'utf8');
    const data = Papa.parse<Array<string>>(fileContent);

    const db = await init();
    const roots = new Map();

    const rootIds = [...new Set( data.data.map(el => el[5]).filter(el => !!el && !isNaN(Number(el)))) ];

    rootIds.forEach((id) => {
        db.prepare("insert into morphemes (value, updatedAt) values (?, ?)")
            .run(id, new Date().toISOString());
    });

    // for (const row of data.data) {
    data.data.forEach((row, index) => {
        if (!index) return; // The first one

        const [
            cyr,
            lat,
            trans,
            en,
            ru,
            rootId,
            pos,
            decl,
            synonym,
            fieldCsv,
            meaning,
            mk,
            sr,
            uk,
            bg,
            pl,
            bl,
            cz,
            sl,
        ] = row;

        if (!cyr) return;

        const value = mapNslToStandard(cyr);
        const lat_2 = mapNslToEtymologized(cyr);

        const langMap: Record<string, string> = {};
        if (ru) langMap.ru = ru;
        if (uk) langMap.uk = uk;
        if (pl) langMap.pl = pl;
        if (cz) langMap.cs = cz;
        if (sl) langMap.sl = sl;
        if (sr) langMap.sr = sr;
        if (mk) langMap.mk = mk;
        if (bg) langMap.bg = bg;
        if (bl) langMap.be = bl;
        const intelligibility = buildIntelligibilityString(lat_2, langMap);

        const [wId, mId] = insertRow(db, roots, {
            cyr,
            lat: lat_2,
            value,
            trans,
            rootId,
            pos,
            decl,
            synonym,
            fieldCsv,
            meaning,
            etymology: `https://en.wiktionary.org/wiki/${value}`,
            intelligibility,
        });

        insertLang(db, "ru", wId, mId, ru);
        insertLang(db, "en", wId, mId, en);
        if (mk) {
            insertLang(db, "mk", wId, mId, mk);
        }
        if (sr) {
            insertLang(db, "sr", wId, mId, sr);
        }
        if (bg) {
            insertLang(db, "bg", wId, mId, bg);
        }
        if (pl) {
            insertLang(db, "pl", wId, mId, pl);
        }
        if (cz) {
            insertLang(db, "cs", wId, mId, cz);
        }
        if (uk) {
            insertLang(db, "uk", wId, mId, uk);
        }
    });
};

(async () => {
    await fillDb();
})();
