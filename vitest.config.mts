import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "."),
        },
    },
    test: {
        environment: "node",
        include: ["**/*.test.ts"],
        exclude: [
            "**/node_modules/**",
            ".claude/**",
            // Manual inspection scripts with no assertions - meant to be run
            // via `npx tsx` and eyeballed, not real automated tests.
            "lib/analyze-text.test.ts",
            "lib/cql/cqlParser.test.ts",
            "lib/corpus/tokenizer/tokenizer.test.ts",
            // Broken demo code: imports a top-level `@prisma/client` (doesn't
            // resolve in this project's four-separate-generated-clients setup,
            // see AGENTS.md) and opens a nonexistent `analytics.db`.
            "lib/cql/cqlTranslator.test.ts",
            // Hits the live corpus.db via CorpusInjector, which is itself
            // documented dead code (zero real importers, see AGENTS.md) -
            // must not run as part of an automated suite.
            "lib/corpus/CorpusInjector.test.ts",
            // Empty file (just a commented-out usage example, no code at all).
            "lib/grammar/common/common.test.ts",
        ],
    },
});
