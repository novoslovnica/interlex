import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import Papa from "papaparse";
import {init} from "@/lib/sqlite";
import {csvGrammarMapper} from "@/lib/grammar/common";

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

const insertLang = (db, lang: string, wordId: bigint, meaning: bigint, value: string) => {
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

const insertRow = (db, {
    externalId,
     addition,
     cyr,
     lat,
     value,
     trans,
     rootId,
     decl,
     field,
     meaning,
     examples,
     etymology,
    genesis,
    frequency,
    intelligibility,
     sameInLanguages,
    pos,
    aspect,
    transitivity,
    animacy,
    degree,
    pronType,
    numType,
    gender,
}: {
    externalId: number;
    addition: string;
    cyr: string;
    lat: string;
    value: string;
    trans: string;
    rootId: string;
    decl: string;
    field: string;
    meaning: string;
    examples: string;
    etymology: string;
    genesis: string;
    frequency: string;
    intelligibility: string;
    sameInLanguages: string;
    pos?: string;
    aspect?: string;
    transitivity?: string;
    animacy?: string;
    degree?: string;
    pronType?: string;
    numType?: string;
    gender?: string;
}): [bigint, bigint] => {
    const insert = db.prepare(`INSERT INTO words (
        external_id,
        value,
        isv,
        nsl,
        transcription,
        field,
        declension,
        conjunction,
        etymology,
        genesis,
        frequency,
        intelligibility,
        addition,
        sameInLanguages,
        pos,         
        aspect,        
        transitivity, 
        animacy,  
        degree,       
        pronType,       
        numType,        
                   gender
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const r = insert.run(
        externalId,
        value,
        lat,
        cyr,
        trans,
        field,
        decl,
        decl,
        etymology,
        genesis,
        frequency,
        intelligibility,
        addition,
        sameInLanguages,
        pos,
        aspect || null,
        transitivity || null,
        animacy || null,
        degree || null,
        pronType || null,
        numType || null,
        gender || null,
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

    const db = await init();

    data.data.forEach((row, index) => {
        if (!index) return;

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

        const grammar = csvGrammarMapper(partOfSpeech);

        const [wId, mId] = insertRow(db, {
            externalId: parseInt(id, 10),
            addition,
            cyr: "",
            lat: isv,
            value: isv,
            trans: "",
            rootId: "",
            decl: type,
            field: "",
            meaning: "",
            genesis,
            etymology: `https://en.wiktionary.org/wiki/${isv}`,
            frequency,
            intelligibility,
            examples: using_example,
            sameInLanguages,
            pos: grammar.pos,
            animacy: grammar.animacy,
            aspect: grammar.aspect,
            transitivity: grammar.transitivity,
            degree: grammar.degree,
            pronType: grammar.pronType,
            numType: grammar.numType,
            gender: grammar.gender,
        });

        insertLang(db, "ru", wId, mId, ru);
        insertLang(db, "en", wId, mId, en);
        if (mk) {
            insertLang(db, "en", wId, mId, en);
        }
        if (sr) {
            insertLang(db, "sr", wId, mId, sr);
        }
        if (uk) {
            insertLang(db, "uk", wId, mId, uk);
        }
        if (bg) {
            insertLang(db, "bg", wId, mId, bg);
        }
        if (pl) {
            insertLang(db, "pl", wId, mId, pl);
        }
        if (be) {
            insertLang(db, "be", wId, mId, be);
        }
        if (cs) {
            insertLang(db, "cs", wId, mId, cs);
        }
        if (sk) {
            insertLang(db, "sk", wId, mId, sk);
        }
        if (sl) {
            insertLang(db, "sl", wId, mId, sl);
        }
        if (hr) {
            insertLang(db, "hr", wId, mId, hr);
        }
        if (cu) {
            insertLang(db, "cu", wId, mId, cu);
        }
        if (de) {
            insertLang(db, "de", wId, mId, de);
        }
        if (nl) {
            insertLang(db, "nl", wId, mId, nl);
        }
        if (eo) {
            insertLang(db, "eo", wId, mId, eo);
        }

        // if (index > 100 && index < 130) {
        //     console.log(isv, ru, genesis);
        // }
    })
};

(async () => {
    await fillDb();
})();