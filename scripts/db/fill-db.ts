import Papa from "papaparse";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import {init} from "@/lib/sqlite";
import {mapNslToEtymologized, mapNslToStandard} from "@/lib/nsl";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const file = path.resolve(process.cwd(), 'slovnik.csv');

const insertLang = (db, lang: string, wordId: bigint, meaningId: bigint, value: string) => {
   db.prepare(`insert into ${lang} (
                     value,
                     veryfied,
                     wordId,
                     meaningId
                 ) values (?, ?, ?, ?)`)
        .run(value, 0, wordId, meaningId);
};

const insertRow = (db, roots, {
    cyr,
    lat,
    value,
    trans,
    rootId,
    pos,
    decl,
    synonym,
    field,
    meaning,
    etymology,
}: {
    cyr: string;
    lat: string;
    value: string;
    trans: string;
    rootId: string;
    pos: string;
    decl: string;
    synonym: string;
    field: string;
    meaning: string;
    etymology: string;
}): Promise<[bigint, bigint]> => {
    const insert = db.prepare(`INSERT INTO words (
        value,
        isv,
        nsl,
        transcription,
        field,
        declension,
        etymology,
        pos
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    const r = insert.run(
        value,
        lat,
        cyr,
        trans,
        field,
        decl,
        etymology,
        pos
    );
    const wId = r.lastInsertRowid;

    const insertMeaning = db.prepare(`INSERT INTO meanings (
        wordId,
        meaning,
        examples
    ) VALUES (?, ?, ?)`);
    const rM = insertMeaning.run(
        wId,
        meaning || "",
        ""
    );
    const mId = rM.lastInsertRowid;

    // if (rootId && !roots.has(rootId)) {
    //     const r = db.prepare("insert into roots (value) values (?)")
    //         .run(rootId);
    //     const newId = r.lastInsertRowid as bigint;
    //
    //     roots.set(rootId, newId);
    // }

    if (rootId) {
        // const dbRootId = roots.get(rootId);

        // console.log(cyr, dbRootId);

        const rId = db.prepare("select id from roots where value = ?")
                .get(rootId);

        db.prepare(`INSERT INTO roots_words (
        wordId,
        rootId
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
        db.prepare("insert into roots (value) values (?)")
            .run(id);
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
            field,
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

        const [wId, mId] = insertRow(db, roots, {
            cyr,
            lat: lat_2,
            value,
            trans,
            rootId,
            pos,
            decl,
            synonym,
            field,
            meaning,
            etymology: `https://en.wiktionary.org/wiki/${value}`,
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
