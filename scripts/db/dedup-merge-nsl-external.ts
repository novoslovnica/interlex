import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { mergeLexemes, getDataDbPath, type MergeUpdatedFields } from "@/lib/dedup/mergeLexemes";

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") });

// Auto-merges duplicate lexemes coming from the two dictionary sources this
// project ingests: novoslovnica-sourced entries (identifiable by a populated
// NSL allophone in lexeme_allophones, external_id IS NULL) and the official
// Interslavic dictionary (external_id IS NOT NULL). Confirmed by direct query
// before writing this: the two sets are fully disjoint (0 lexemes carry both
// markers), 25507 lexemes total = 7578 NSL-only + 17929 external_id-only.
//
// Matching key is the CORE (Latin ISV) allophone value. Only pairs that are
// UNAMBIGUOUS are auto-merged: exactly one NSL-sourced lexeme and exactly one
// external_id-sourced lexeme share that CORE value, AND their `pos` matches.
// Everything else (a CORE value matching >1 lexeme on either side, or a
// matched pair whose `pos` differs) is written to a CSV review report instead
// of being touched — those are the cases that risk conflating two genuine
// homonyms (e.g. "hvala" ADP "thanks" vs ADP "praise sung in church" — same
// spelling and pos, different words). Review those manually via the existing
// /admin/deduplication UI.
//
// The official (external_id) lexeme of a matched pair is always kept as the
// merge target; the novoslovnica lexeme is the source being merged in (its
// only unique contribution is its NSL Cyrillic allophone, which gets copied
// onto the target). All of the target's own fields are passed through
// unchanged via mergeLexemes()'s fields.
//
// Reuses the exact same merge transaction (lib/dedup/mergeLexemes.ts) used by
// the admin merge UI (app/admin/deduplication/actions.ts) — no separate copy
// of that logic to drift out of sync.
//
// Usage:
//   npx tsx scripts/db/dedup-merge-nsl-external.ts                 # dry run, prints + writes review CSV
//   npx tsx scripts/db/dedup-merge-nsl-external.ts --execute        # backs up the DB, then actually merges
//   npx tsx scripts/db/dedup-merge-nsl-external.ts --execute --limit=20   # merge only the first 20 (testing)
//   npx tsx scripts/db/dedup-merge-nsl-external.ts --report=/path/to/out.csv
//
// Idempotent: once a novoslovnica lexeme is merged in, it's deleted, so
// re-running the script naturally shrinks the candidate set on each pass.

const AUTHOR = "system:dedup-nsl-external-script";

interface LexemeRow {
    id: number;
    value: string | null;
    pos: string | null;
    stem: string | null;
    gender: string | null;
    declension: number | null;
    conjugation: number | null;
    transcription: string | null;
    mainCategory: string | null;
    etymology: string | null;
    addition: string | null;
    usageType: string | null;
    external_id: number | null;
    coreValue: string;
    nslValue: string | null;
}

function parseArgs() {
    const args = process.argv.slice(2);
    const execute = args.includes("--execute");
    const limitArg = args.find((a) => a.startsWith("--limit="));
    const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
    const reportArg = args.find((a) => a.startsWith("--report="));
    const reportPath = reportArg
        ? reportArg.split("=")[1]
        : path.join(os.tmpdir(), `dedup-nsl-external-review-${new Date().toISOString().slice(0, 10)}.csv`);
    return { execute, limit, reportPath };
}

function dedupJoin(parts: (string | null | undefined)[]): string {
    const set = Array.from(new Set(parts.filter((p): p is string => Boolean(p && p.trim()))));
    return set.join(", ");
}

function csvEscape(v: unknown): string {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fetchSide(db: Database.Database, side: "nsl" | "ext"): Map<string, LexemeRow[]> {
    const whereExternal = side === "nsl" ? "l.external_id IS NULL" : "l.external_id IS NOT NULL";
    const rows = db
        .prepare(
            `
        SELECT l.id, l.value, l.pos, l.stem, l.gender, l.declension, l.conjugation,
               l.transcription, l.mainCategory, l.etymology, l.addition, l.usageType,
               l.external_id,
               core.value AS coreValue,
               nsl.value AS nslValue
        FROM lexemes l
        JOIN lexeme_allophones core ON core.lexemeId = l.id AND core.type = 'standard'
        JOIN allophone_flavors coreFlavor ON coreFlavor.id = core.flavorId AND coreFlavor.code = 'CORE'
        LEFT JOIN lexeme_allophones nsl ON nsl.lexemeId = l.id AND nsl.type = 'standard'
            AND nsl.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'NSL')
        WHERE ${whereExternal} AND core.value IS NOT NULL AND core.value != ''
    `
        )
        .all() as LexemeRow[];

    const map = new Map<string, LexemeRow[]>();
    for (const row of rows) {
        const list = map.get(row.coreValue) ?? [];
        list.push(row);
        map.set(row.coreValue, list);
    }
    return map;
}

function buildUpdatedFields(target: LexemeRow, source: LexemeRow): MergeUpdatedFields {
    return {
        value: target.value ?? "",
        isv: target.coreValue,
        nsl: target.nslValue || source.nslValue || "",
        usageType: target.usageType || source.usageType || "",
        addition: dedupJoin([target.addition, source.addition]),
        stem: target.stem,
        pos: target.pos,
        gender: target.gender,
        declension: target.declension,
        conjugation: target.conjugation,
        transcription: target.transcription,
        mainCategory: target.mainCategory,
        etymology: target.etymology,
        external_id: target.external_id,
    };
}

function main() {
    const { execute, limit, reportPath } = parseArgs();
    const dbPath = getDataDbPath();
    console.log(`Target DB: ${dbPath}`);
    console.log(`Mode: ${execute ? "EXECUTE (will write to the DB)" : "DRY RUN (no writes)"}\n`);

    const db = new Database(dbPath);
    // WebStorm's Prisma language server (and other tools) can briefly open the
    // same file; without this, better-sqlite3 throws SQLITE_BUSY immediately
    // instead of waiting the lock out.
    db.pragma("busy_timeout = 5000");

    const nslByValue = fetchSide(db, "nsl");
    const extByValue = fetchSide(db, "ext");

    const toMerge: { target: LexemeRow; source: LexemeRow }[] = [];
    const reviewRows: { reason: string; coreValue: string; nslIds: string; extIds: string; nslPos: string; extPos: string }[] = [];

    const allValues = new Set([...nslByValue.keys(), ...extByValue.keys()]);
    for (const coreValue of allValues) {
        const nslRows = nslByValue.get(coreValue) ?? [];
        const extRows = extByValue.get(coreValue) ?? [];
        if (nslRows.length === 0 || extRows.length === 0) continue;

        if (nslRows.length > 1 || extRows.length > 1) {
            reviewRows.push({
                reason: "ambiguous",
                coreValue,
                nslIds: nslRows.map((r) => r.id).join("|"),
                extIds: extRows.map((r) => r.id).join("|"),
                nslPos: Array.from(new Set(nslRows.map((r) => r.pos ?? ""))).join("|"),
                extPos: Array.from(new Set(extRows.map((r) => r.pos ?? ""))).join("|"),
            });
            continue;
        }

        const nsl = nslRows[0];
        const ext = extRows[0];
        if ((nsl.pos ?? "") !== (ext.pos ?? "")) {
            reviewRows.push({
                reason: "pos_mismatch",
                coreValue,
                nslIds: String(nsl.id),
                extIds: String(ext.id),
                nslPos: nsl.pos ?? "",
                extPos: ext.pos ?? "",
            });
            continue;
        }

        toMerge.push({ target: ext, source: nsl });
    }

    const limited = limit ? toMerge.slice(0, limit) : toMerge;

    console.log(`Unambiguous, pos-matched pairs to merge: ${toMerge.length}${limit ? ` (running first ${limited.length})` : ""}`);
    console.log(`Flagged for manual review (ambiguous or pos-mismatched): ${reviewRows.length}`);
    console.log(`Review report will be written to: ${reportPath}\n`);

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    const csvLines = ["reason,coreValue,nslLexemeIds,extLexemeIds,nslPos,extPos"];
    for (const r of reviewRows) {
        csvLines.push([r.reason, r.coreValue, r.nslIds, r.extIds, r.nslPos, r.extPos].map(csvEscape).join(","));
    }
    fs.writeFileSync(reportPath, csvLines.join("\n") + "\n");

    if (!execute) {
        console.log("Sample of planned merges (target=official/external_id kept, source=novoslovnica deleted):");
        for (const { target, source } of limited.slice(0, 20)) {
            console.log(`  keep #${target.id} "${target.value}" (${target.pos})  <-  merge #${source.id} "${source.value}", nsl="${source.nslValue}"`);
        }
        if (limited.length > 20) console.log(`  ... and ${limited.length - 20} more`);
        console.log("\nDry run only — no changes written. Re-run with --execute to perform the merge.");
        db.close();
        return;
    }

    const backupPath = `${dbPath}.backup-before-nsl-external-dedup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Backed up DB to: ${backupPath}\n`);

    let merged = 0;
    let failed = 0;
    const failures: { targetId: number; sourceId: number; error: string }[] = [];

    for (const { target, source } of limited) {
        try {
            const updatedFields = buildUpdatedFields(target, source);
            db.transaction(() => {
                mergeLexemes(db, target.id, source.id, updatedFields, AUTHOR, null);
            })();
            merged++;
        } catch (error: any) {
            failed++;
            failures.push({ targetId: target.id, sourceId: source.id, error: error.message || String(error) });
            console.error(`  FAILED merging #${source.id} into #${target.id}: ${error.message || error}`);
        }
    }

    console.log(`\nDone. Merged: ${merged}. Failed: ${failed}.`);
    if (failures.length > 0) {
        console.log("Failures:", JSON.stringify(failures, null, 2));
    }

    db.close();
}

main();
