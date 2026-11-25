import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { runReviewedAffixes } from "./lib/reviewed-affix-links"

const helper = readFileSync("scripts/db/lib/reviewed-affix-links.ts")
if (createHash("sha256").update(helper).digest("hex") !== "a9602f1d13a4275027c816e69d9c2a03c5fc7fa7575c048b8028395a457ea048") {
    throw new Error("The reviewed affix runner does not match this script version")
}

runReviewedAffixes(
    "data/morpheme-review/2026-11-25-pass-28.json",
    "c0bfeb359c022d059df0ce2abac73fd776a5100ec98a7c29a80153152c3c7f56",
    "script:review-morpheme-affixes-28",
)
