// DB-runner entry point for appending articles without retokenizing existing documents.
const args = process.argv.slice(2)
const checkpoint = args.find(arg => /^--after-page-id=[1-9]\d*$/.test(arg))
if (!checkpoint || args.some(arg => arg !== checkpoint && arg !== "--apply")) {
    throw new Error("Expected --after-page-id=<last imported page ID>")
}

process.argv.push("--new-only", "--skip-frequencies")
if (!args.includes("--apply")) process.argv.push("--dry-run")

void import("../crawl-isv-wikipedia").catch(error => {
    console.error(error)
    process.exitCode = 1
})
