import {describe, expect, it} from "vitest"
import {resolveDatabaseUrls} from "./databaseUrls"

describe("shared database locations", () => {
    it("resolves all five defaults at the project root, never prisma/ or app.db", () => {
        expect(resolveDatabaseUrls({}, "/tmp/interlex-fixture")).toEqual({
            auth: "file:/tmp/interlex-fixture/auth.db",
            data: "file:/tmp/interlex-fixture/interlex.db",
            library: "file:/tmp/interlex-fixture/library.db",
            corpus: "file:/tmp/interlex-fixture/corpus.db",
            historical: "file:/tmp/interlex-fixture/historical.db",
        })
    })
    it("preserves explicitly configured URLs and treats empty values as missing", () => {
        expect(resolveDatabaseUrls({DATA_DATABASE_URL: "file:/tmp/custom.db", AUTH_DATABASE_URL: "file:./custom-auth.db", CORPUS_DATABASE_URL: ""}, "/tmp/project"))
            .toMatchObject({data: "file:/tmp/custom.db", auth: "file:./custom-auth.db", corpus: "file:/tmp/project/corpus.db"})
    })
})
