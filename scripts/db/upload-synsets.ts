import * as path from 'path'
import fs from 'fs'
import {init} from "@/lib/sqlite";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), 'interlex.db')}`

interface SynsetEntry {
    synsetId: string;
    synsetExternalId?: string;
    definition?: string;
    domains?: string;
    partOfSpeech?: string;
}

interface EnrichedEntry {
    meaningId: number;
    wordId: number;
    isvWord: string;
    synsets: SynsetEntry[];
}

async function main() {
    const { prismaData: db } = await import('@/lib/prisma')

    const inputPath = path.resolve(process.cwd(), './scripts/python/words_enriched.json')
    const data: EnrichedEntry[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

    let synsetsCreated = 0
    let synsetsSkipped = 0
    let linksCreated = 0
    let linksSkipped = 0

    const dbSimple = await init();

    const validMeaningIds = new Set(
        dbSimple.prepare('SELECT id FROM meanings').all().map((r: any) => r.id)
    );
    console.error(`Valid meaningIds in DB: ${validMeaningIds.size}`);

    const insertSynset = dbSimple.prepare(`
        insert or ignore into synsets ("synsetId", synset_external_id, definition, domains, part_of_speech)
        values (?, ?, ?, ?, ?)
    `);

    const insertLink = dbSimple.prepare(`
        insert or ignore into meanings_synsets ("meaningId", "synsetId", source, confidence)
        values (?, ?, ?, ?)
    `);

    const insertSynsetTransaction = dbSimple.transaction((entries: { synsetId: string; synsetExternalId: string | null; definition: string | null; domains: string | null; partOfSpeech: string | null }[]) => {
        for (const e of entries) {
            const result = insertSynset.run(e.synsetId, e.synsetExternalId, e.definition, e.domains, e.partOfSpeech);
            if (result.changes > 0) synsetsCreated++;
            else synsetsSkipped++;
        }
    });

    const insertLinkTransaction = dbSimple.transaction((entries: { meaningId: number; synsetId: string; source: string; confidence: number }[]) => {
        for (const e of entries) {
            const result = insertLink.run(e.meaningId, e.synsetId, e.source, e.confidence);
            if (result.changes > 0) linksCreated++;
            else linksSkipped++;
        }
    });

    for (const entry of data) {
        if (!entry.meaningId) continue;
        if (!validMeaningIds.has(entry.meaningId)) {
            linksSkipped += (entry.synsets?.length ?? 0);
            continue;
        }
        if (!entry.synsets || entry.synsets.length === 0) continue;

        const synsetRows = entry.synsets.map(s => ({
            synsetId: s.synsetId,
            synsetExternalId: s.synsetExternalId ?? null,
            definition: s.definition ?? null,
            domains: s.domains ?? null,
            partOfSpeech: s.partOfSpeech ?? null,
        }));

        insertSynsetTransaction(synsetRows);

        const linkRows = entry.synsets.map(s => ({
            meaningId: entry.meaningId,
            synsetId: s.synsetId,
            source: 'ruwordnet_auto',
            confidence: 1.0,
        }));

        insertLinkTransaction(linkRows);
    }

    console.error(`Synsets: ${synsetsCreated} created, ${synsetsSkipped} skipped`)
    console.error(`Links: ${linksCreated} created, ${linksSkipped} skipped`)
    await db.$disconnect()
}

main().catch(e => {
    console.error('Fatal error:', e)
    process.exit(1)
})