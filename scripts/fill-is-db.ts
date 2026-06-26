import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import Papa from "papaparse";
import {init} from "@/lib/sqlite";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const file = path.resolve(process.cwd(), 'slovnik-2.csv');

const rootMap: {
    [key: string]: bigint;
} = {};

function checkAndCleanString(inputStr: string) {
    let isValid = true;
    let cleanedStr = inputStr;

    // Проверяем, начинается ли строка с символа "!"
    if (inputStr.startsWith('!')) {
        isValid = false;
        // Обрезаем строку, убирая самый первый символ "!"
        cleanedStr = inputStr.slice(1);
    }

    // Возвращаем объект, содержащий логический флаг и очищенную строку
    return {
        isValid: isValid,
        cleanedStr: cleanedStr
    };
}

const insertLang = async (lang: string, wordId: bigint, meaning: bigint, value: string) => {
    const db = await init();

    const {
        isValid,
        cleanedStr,
    } = checkAndCleanString(value);

    db.prepare(`insert into ${lang} (
         value,
         veryfied,
         wordId,
         meaningId
     ) values (?, ?, ?, ?)`)
        .run(cleanedStr, isValid ? 1 : 0, wordId, meaning);
};

const insertRow = async ({
    externalId,
     addition,
     cyr,
     lat,
     value,
     trans,
     rootId,
     pos,
     decl,
     field,
     meaning,
     examples,
     etymology,
    genesis,
    frequency,
    intelligibility,
     sameInLanguages,
 }: {
    externalId: number;
    addition: string;
    cyr: string;
    lat: string;
    value: string;
    trans: string;
    rootId: string;
    pos: string;
    decl: string;
    field: string;
    meaning: string;
    examples: string;
    etymology: string;
    genesis: string;
    frequency: string;
    intelligibility: string;
    sameInLanguages: string;
}): Promise<[bigint, bigint]> => {
    const db = await init();

    const insert = db.prepare(`INSERT INTO words (
        external_id,
        value,
        isv,
        nsl,
        transcription,
        field,
        declension,
        etymology,
        pos,
        genesis,
        frequency,
       intelligibility,
        addition,
        sameInLanguages
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const r = insert.run(
        externalId,
        value,
        lat,
        cyr,
        trans,
        field,
        decl,
        etymology,
        pos,
        genesis,
        frequency,
        intelligibility,
        addition,
        sameInLanguages,
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
        examples || "",
    );
    const mId = rM.lastInsertRowid;

    // if (!rootMap[rootId]) {
    //     const r = db.prepare("insert into roots (value) values (?)")
    //         .run(rootId);
    //     const newId = r.lastInsertRowid as bigint;
    //
    //     rootMap[rootId] = newId;
    // }
    //
    // db.prepare(`INSERT INTO roots_words (
    //     wordId,
    //     rootId
    // ) VALUES (?, ?)`).run(
    //     wId,
    //     rootMap[rootId]
    // );

    return [wId as bigint, mId as bigint];
};

const fillDb = async () => {
    const fileContent = fs.readFileSync(file, 'utf8');
    const data = Papa.parse<Array<string>>(fileContent);

    let index = 0;
    for await (const row of data.data) {
        index++;
        if (index === 1) continue; // The first one

        const [
            id,
            isv,
            addition,
            partOfSpeech,
            type,
            en,
            sameInLanguages,
            genesis,
            ru,
            be,
            uk,
            pl,
            cs,
            sk,
            sl,
            hr,
            sr,
            mk,
            bg,
            cu,
            de,
            nl,
            eo,
            frequency,
            intelligibility,
            using_example
        ] = row;

        const [wId, mId] = await insertRow({
            externalId: parseInt(id, 10),
            addition,
            cyr: "",
            lat: isv,
            value: isv,
            trans: "",
            rootId: "",
            pos: partOfSpeech,
            decl: type,
            field: "",
            meaning: "",
            genesis,
            etymology: `https://en.wiktionary.org/wiki/${isv}`,
            frequency,
            intelligibility,
            examples: using_example,
            sameInLanguages,
        });

        await insertLang("ru", wId, mId, ru);
        await insertLang("en", wId, mId, en);
        if (mk) {
            await insertLang("en", wId, mId, en);
        }
        if (sr) {
            await insertLang("sr", wId, mId, sr);
        }
        if (uk) {
            await insertLang("uk", wId, mId, uk);
        }
        if (bg) {
            await insertLang("bg", wId, mId, bg);
        }
        if (pl) {
            await insertLang("pl", wId, mId, pl);
        }
        if (be) {
            await insertLang("be", wId, mId, be);
        }
        if (cs) {
            await insertLang("cs", wId, mId, cs);
        }
        if (sk) {
            await insertLang("sk", wId, mId, sk);
        }
        if (sl) {
            await insertLang("sl", wId, mId, sl);
        }
        if (hr) {
            await insertLang("hr", wId, mId, hr);
        }
        if (cu) {
            await insertLang("cu", wId, mId, cu);
        }
        if (de) {
            await insertLang("de", wId, mId, de);
        }
        if (nl) {
            await insertLang("nl", wId, mId, nl);
        }
        if (eo) {
            await insertLang("eo", wId, mId, eo);
        }

        if (index > 100 && index < 130) {
            console.log(isv, ru, genesis);
        }
    }
    // data.data.forEach((row, index) => {
    //
    // })
};

(async () => {
    await fillDb();
})();