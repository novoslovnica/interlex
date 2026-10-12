import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import {init} from "@/lib/sqlite";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

interface EssjaEntry {
    lemma: string;
    body: string;
    source_url: string;
}

const seedProto = async () => {
    const db = await init();

    db.exec(`CREATE TABLE IF NOT EXISTS proto_slavic_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lemma TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT ''
    )`);

    // Источник лежит в репозитории сжатым (46 МБ -> 12 МБ): читаем .gz,
    // для обратной совместимости — распакованный .json, если он есть.
    const jsonPath = path.resolve(process.cwd(), 'data/essja_dump.json');
    const gzPath = `${jsonPath}.gz`;
    const raw = fs.existsSync(gzPath)
        ? zlib.gunzipSync(fs.readFileSync(gzPath)).toString('utf-8')
        : fs.readFileSync(jsonPath, 'utf-8');
    const entries: EssjaEntry[] = JSON.parse(raw);

    const insert = db.prepare(
        'INSERT INTO proto_slavic_words (lemma, body, source_url) VALUES (?, ?, ?)'
    );

    const batch = db.transaction((items: EssjaEntry[]) => {
        for (const item of items) {
            const lemma = item.lemma.replace(/^\*/, '');
            insert.run(lemma, item.body, item.source_url);
        }
    });

    batch(entries);

    console.log(`Seeded ${entries.length} proto-slavic words.`);
};

(async () => {
    await seedProto();
})();