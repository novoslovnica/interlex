import Database from "better-sqlite3";
import { createHash, randomBytes } from "crypto";
import { buildZip } from "./zip";

// Builds a .apkg file (an Anki deck package) from a flat list of
// front/back notes. .apkg is just a ZIP containing a SQLite database
// ("collection.anki2") in Anki's legacy schema-11 format plus a media
// manifest - this targets that legacy schema deliberately, since modern
// Anki still reads and auto-upgrades it on import, giving the widest
// compatibility across Anki versions without needing per-version branches.
//
// There is no zip/apkg dependency in this project (see package.json), so
// both the SQLite schema below and the ZIP container (lib/anki/zip.ts) are
// hand-built from the documented format rather than pulled from a library.

export interface AnkiNoteInput {
    front: string;
    back: string;
    tags?: string[];
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fieldChecksum(field: string): number {
    const hash = createHash("sha1").update(field, "utf8").digest("hex");
    return parseInt(hash.slice(0, 8), 16);
}

function randomGuid(): string {
    return randomBytes(10).toString("base64url");
}

const SCHEMA_SQL = `
CREATE TABLE col (
    id integer PRIMARY KEY,
    crt integer NOT NULL,
    mod integer NOT NULL,
    scm integer NOT NULL,
    ver integer NOT NULL,
    dty integer NOT NULL,
    usn integer NOT NULL,
    ls integer NOT NULL,
    conf text NOT NULL,
    models text NOT NULL,
    decks text NOT NULL,
    dconf text NOT NULL,
    tags text NOT NULL
);
CREATE TABLE notes (
    id integer PRIMARY KEY,
    guid text NOT NULL,
    mid integer NOT NULL,
    mod integer NOT NULL,
    usn integer NOT NULL,
    tags text NOT NULL,
    flds text NOT NULL,
    sfld text NOT NULL,
    csum integer NOT NULL,
    flags integer NOT NULL,
    data text NOT NULL
);
CREATE TABLE cards (
    id integer PRIMARY KEY,
    nid integer NOT NULL,
    did integer NOT NULL,
    ord integer NOT NULL,
    mod integer NOT NULL,
    usn integer NOT NULL,
    type integer NOT NULL,
    queue integer NOT NULL,
    due integer NOT NULL,
    ivl integer NOT NULL,
    factor integer NOT NULL,
    reps integer NOT NULL,
    lapses integer NOT NULL,
    left integer NOT NULL,
    odue integer NOT NULL,
    odid integer NOT NULL,
    flags integer NOT NULL,
    data text NOT NULL
);
CREATE TABLE revlog (
    id integer PRIMARY KEY,
    cid integer NOT NULL,
    usn integer NOT NULL,
    ease integer NOT NULL,
    ivl integer NOT NULL,
    lastIvl integer NOT NULL,
    factor integer NOT NULL,
    time integer NOT NULL,
    type integer NOT NULL
);
CREATE TABLE graves (
    usn integer NOT NULL,
    oid integer NOT NULL,
    type integer NOT NULL
);
CREATE INDEX ix_notes_usn ON notes (usn);
CREATE INDEX ix_cards_usn ON cards (usn);
CREATE INDEX ix_revlog_usn ON revlog (usn);
CREATE INDEX ix_cards_nid ON cards (nid);
CREATE INDEX ix_cards_sched ON cards (did, queue, due);
CREATE INDEX ix_revlog_cid ON revlog (cid);
CREATE INDEX ix_notes_csum ON notes (csum);
`;

export function buildApkg(deckName: string, notes: AnkiNoteInput[]): Buffer {
    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const modelId = nowMs;
    const deckId = nowMs + 1;

    const db = new Database(":memory:");
    db.exec(SCHEMA_SQL);

    const model = {
        id: modelId,
        name: "Interlex",
        type: 0,
        mod: nowSec,
        usn: 0,
        sortf: 0,
        did: deckId,
        tmpls: [
            {
                name: "Card 1",
                ord: 0,
                qfmt: "{{Front}}",
                afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
                bqfmt: "",
                bafmt: "",
                did: null,
                bfont: "",
                bsize: 0,
            },
        ],
        flds: [
            { name: "Front", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20, media: [] },
            { name: "Back", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20, media: [] },
        ],
        css: ".card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }",
        latexPre: "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\signature{}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
        latexPost: "\\end{document}",
        latexsvg: false,
        req: [[0, "any", [0]]],
    };

    const defaultDeck = {
        id: 1,
        name: "Default",
        extendRev: 50,
        usn: 0,
        collapsed: true,
        newToday: [0, 0],
        revToday: [0, 0],
        lrnToday: [0, 0],
        timeToday: [0, 0],
        conf: 1,
        desc: "",
        dyn: 0,
        extendNew: 10,
        mod: 0,
    };
    const deck = {
        ...defaultDeck,
        id: deckId,
        name: deckName,
        collapsed: false,
        mod: nowSec,
    };

    const dconf = {
        "1": {
            id: 1,
            name: "Default",
            replayq: true,
            lapse: { leechFails: 8, minInt: 1, delays: [10], leechAction: 0, mult: 0 },
            rev: { perDay: 100, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, ease4: 1.3, bury: true, minSpace: 1 },
            timer: 0,
            maxTaken: 60,
            usn: 0,
            new: { perDay: 20, delays: [1, 10], separate: true, ints: [1, 4, 7], initialFactor: 2500, bury: true, order: 1 },
            mod: 0,
            autoplay: true,
        },
    };

    const conf = {
        nextPos: 1,
        estTimes: true,
        activeDecks: [deckId],
        sortType: "noteFld",
        timeLim: 0,
        sortBackwards: false,
        addToCur: true,
        curDeck: deckId,
        newBury: true,
        newSpread: 0,
        dueCounts: true,
        curModel: String(modelId),
        collapseTime: 1200,
    };

    db.prepare(
        `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')`
    ).run(
        nowSec,
        nowMs,
        nowMs,
        JSON.stringify(conf),
        JSON.stringify({ [modelId]: model }),
        JSON.stringify({ "1": defaultDeck, [deckId]: deck }),
        JSON.stringify(dconf)
    );

    const insertNote = db.prepare(
        `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')`
    );
    const insertCard = db.prepare(
        `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')`
    );

    let idCounter = nowMs + 1000;
    let duePosition = 1;
    for (const note of notes) {
        const noteId = idCounter++;
        const cardId = idCounter++;
        const front = escapeHtml(note.front);
        const back = escapeHtml(note.back);
        const flds = `${front}\u001f${back}`;
        const tags = note.tags && note.tags.length > 0 ? ` ${note.tags.join(" ")} ` : "";

        insertNote.run(noteId, randomGuid(), modelId, nowSec, tags, flds, front, fieldChecksum(front));
        insertCard.run(cardId, noteId, deckId, nowSec, duePosition++);
    }

    const buffer = db.serialize() as Buffer;
    db.close();

    const zip = buildZip([
        { name: "collection.anki2", data: buffer },
        { name: "media", data: Buffer.from("{}", "utf8") },
    ]);

    return zip;
}
