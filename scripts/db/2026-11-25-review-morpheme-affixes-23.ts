import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { runReviewedAffixes } from "./lib/reviewed-affix-links"

const helper = readFileSync("scripts/db/lib/reviewed-affix-links.ts")
if (createHash("sha256").update(helper).digest("hex") !== "a9602f1d13a4275027c816e69d9c2a03c5fc7fa7575c048b8028395a457ea048") {
    throw new Error("The reviewed affix runner does not match this script version")
}

runReviewedAffixes(
    "data/morpheme-review/2026-11-25-pass-23.json",
    "b282518c8fd82b4160b83ff6522157c9fd2822a599f38e5a5fe37b1905fa7676",
    "script:review-morpheme-affixes-23",
)
