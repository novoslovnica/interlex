import path from "node:path"

/** Runtime clients and Prisma CLI must agree on the same five database files.
 * Existing DATABASE_URL values are preserved; defaults live at project root.
 * This helper never opens a database or creates a file.
 */
export function resolveDatabaseUrls(env: Readonly<Record<string, string | undefined>> = process.env, root = process.cwd()) {
    const resolve = (key: string, filename: string) => env[key] || `file:${path.resolve(root, filename)}`
    return {
        auth: resolve("AUTH_DATABASE_URL", "auth.db"),
        data: resolve("DATA_DATABASE_URL", "interlex.db"),
        library: resolve("LIBRARY_DATABASE_URL", "library.db"),
        corpus: resolve("CORPUS_DATABASE_URL", "corpus.db"),
        historical: resolve("HISTORICAL_DATABASE_URL", "historical.db"),
    }
}
