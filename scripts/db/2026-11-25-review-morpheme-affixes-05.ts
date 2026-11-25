import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { runReviewedAffixes } from "./lib/reviewed-affix-links"

const helper = readFileSync("scripts/db/lib/reviewed-affix-links.ts")
if (createHash("sha256").update(helper).digest("hex") !== "a9602f1d13a4275027c816e69d9c2a03c5fc7fa7575c048b8028395a457ea048") {
    throw new Error("The reviewed affix runner does not match this script version")
}

runReviewedAffixes(
    "data/morpheme-review/2026-11-25-pass-05.json",
    "1a68b4188d9b908d55079a0ea7a521886bbd484d68c709f2edf92c669d80df12",
    "script:review-morpheme-affixes-05",
)
