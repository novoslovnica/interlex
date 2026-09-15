#!/usr/bin/env node
// Ratchet gate for pre-existing lint/type debt (docs/roadmap.md #25-26).
//
// The codebase carries a few hundred known eslint errors and ~120 tsc errors,
// so neither check can simply be made blocking. Instead each check's errors
// are counted per (file, rule) and compared to a committed baseline in
// scripts/ci/baselines/: CI fails if any pair got MORE errors, so new debt
// can't slip in, while fixing old errors never breaks the build. Counting per
// file+rule rather than one global total stops a fix in one place from
// silently "paying for" a new error somewhere else. Line numbers are left
// out on purpose - unrelated edits shift them constantly.
//
//   node scripts/ci/check-baseline.mjs lint|tsc            check
//   node scripts/ci/check-baseline.mjs lint|tsc --update   rewrite the baseline
//
// Run --update after fixing errors to lock the lower count in.

import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "../..")
const BASELINE_DIR = path.join(ROOT, "scripts/ci/baselines")

function run(cmd, args) {
    const result = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 })
    if (result.error) throw result.error
    return result
}

function relative(file) {
    return path.relative(ROOT, file).split(path.sep).join("/")
}

const CHECKS = {
    lint() {
        const { stdout, stderr, status } = run("npx", ["eslint", ".", "-f", "json"])
        let report
        try {
            report = JSON.parse(stdout)
        } catch {
            // Not a report at all means eslint itself crashed (bad config etc.) -
            // that must fail the gate, not read as "zero errors".
            console.error(stderr || stdout)
            throw new Error(`eslint did not produce a JSON report (exit ${status})`)
        }
        const counts = {}
        for (const file of report) {
            for (const message of file.messages) {
                if (message.severity !== 2) continue
                const key = `${relative(file.filePath)} ${message.ruleId ?? "parse-error"}`
                counts[key] = (counts[key] ?? 0) + 1
            }
        }
        return counts
    },

    tsc() {
        const { stdout, stderr, status } = run("npx", ["tsc", "-p", "tsconfig.ci.json", "--noEmit", "--pretty", "false"])
        const counts = {}
        let matched = 0
        for (const line of stdout.split("\n")) {
            const m = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+):/)
            if (!m) continue
            matched++
            const key = `${relative(path.resolve(ROOT, m[1]))} ${m[2]}`
            counts[key] = (counts[key] ?? 0) + 1
        }
        // A non-zero exit with nothing parseable is a config-level failure
        // (e.g. TS5095 without a file position), not a clean run.
        if (status !== 0 && matched === 0) {
            console.error(stdout || stderr)
            throw new Error(`tsc failed without reporting file errors (exit ${status})`)
        }
        return counts
    },
}

function sorted(counts) {
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

function total(counts) {
    return Object.values(counts).reduce((sum, n) => sum + n, 0)
}

const [name, flag] = process.argv.slice(2)
if (!CHECKS[name]) {
    console.error("usage: check-baseline.mjs lint|tsc [--update]")
    process.exit(2)
}

const current = CHECKS[name]()
const baselineFile = path.join(BASELINE_DIR, `${name}.json`)

if (flag === "--update") {
    mkdirSync(BASELINE_DIR, { recursive: true })
    writeFileSync(baselineFile, JSON.stringify(sorted(current), null, 2) + "\n")
    console.log(`${name}: baseline written, ${total(current)} errors`)
    process.exit(0)
}

if (!existsSync(baselineFile)) {
    console.error(`${name}: no baseline at ${relative(baselineFile)} - run with --update first`)
    process.exit(1)
}

const baseline = JSON.parse(readFileSync(baselineFile, "utf8"))
const regressions = []
let improved = 0
for (const key of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    const before = baseline[key] ?? 0
    const after = current[key] ?? 0
    if (after > before) regressions.push(`  ${key}: ${before} -> ${after}`)
    else if (after < before) improved += before - after
}

console.log(`${name}: ${total(current)} errors (baseline ${total(baseline)})`)
if (improved > 0) {
    console.log(`${name}: ${improved} fewer than baseline - run "node scripts/ci/check-baseline.mjs ${name} --update" to lock it in`)
}
if (regressions.length > 0) {
    console.error(`${name}: new errors (file rule: baseline -> now):\n${regressions.join("\n")}`)
    process.exit(1)
}
