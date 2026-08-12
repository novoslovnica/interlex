import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Stray leftover git worktree from a past session (git-ignored via
    // .git/info/exclude, not part of the repo) - was being linted as if it
    // were real source, inflating error counts with a duplicated copy of
    // the codebase.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
