import { afterEach, describe, expect, it } from "vitest"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const source = process.cwd()
const temporary: string[] = []
afterEach(() => { for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })

function fixture(scenario: string) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "interlex-deploy-"))
    temporary.push(temp)
    const root = path.join(temp, "app"), bin = path.join(temp, "bin"), home = path.join(temp, "home")
    fs.mkdirSync(root); fs.mkdirSync(bin); fs.mkdirSync(home)
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
    const write = (name: string, value: string) => {
        const target = path.join(root, name)
        fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value)
    }
    git("init", "-b", "main"); git("config", "user.email", "test@example.org"); git("config", "user.name", "Test")
    write(".gitignore", "node_modules/\n.next/\n*.db\n.env*\nlogs/\nexports/\n.releases/\n.deploy/\ncurrent\nprevious\npublic/audio/\npublic/covers/\nprisma/generated/\n")
    write("package.json", '{"scripts":{"start":"next start"}}')
    write("public/keep", ""); write("scripts/ops/keep", ""); write("prisma/keep", "")
    git("add", "."); git("commit", "-m", "legacy")
    const old = git("rev-parse", "HEAD")
    for (const file of ["scripts/ops/start-release.sh", "scripts/ops/release-env.sh", "rebuild-remote.sh"]) {
        write(file, fs.readFileSync(path.join(source, file), "utf8"))
    }
    write("scripts/ops/check-public-release.mjs", 'process.exit(process.env.SCENARIO === "public-fail" ? 1 : 0)')
    write("package.json", '{"scripts":{"start":"bash scripts/ops/start-release.sh"}}')
    git("add", "."); git("commit", "-m", "isolated deploy")
    const commit = git("rev-parse", "HEAD")
    const origin = path.join(temp, "origin.git")
    execFileSync("git", ["clone", "--bare", root, origin], { stdio: "ignore" })
    git("remote", "add", "origin", origin); git("reset", "--hard", old)
    write(".next/BUILD_ID", "legacy-build")
    write("node_modules/keep", "live-dependencies")
    write("prisma/generated/keep", "live-generated-client")
    write(".env", "SECRET=server-only\n")
    for (const db of ["auth", "interlex", "library", "corpus", "historical"]) write(`${db}.db`, "original-data")
    const stage = path.join(root, ".deploy/test")
    fs.mkdirSync(stage, { recursive: true })
    const mock = (name: string, body: string) => fs.writeFileSync(path.join(bin, name), `#!/usr/bin/env bash\nset -eu\n${body}\n`, { mode: 0o755 })
    mock("flock", '[ "$SCENARIO" != locked ]')
    mock("sleep", ":")
    mock("sudo", 'exec "$@"')
    mock("systemctl", `
        echo "systemctl $*" >> "$INTERLEX_ROOT/events"
        if [ "$1" = start ] && [ "$SCENARIO" = start-fail ] && [ ! -f "$INTERLEX_ROOT/current/.legacy-release" ]; then exit 1; fi
        case "$1" in
            stop) echo stopped > "$INTERLEX_ROOT/state" ;;
            start) echo active > "$INTERLEX_ROOT/state" ;;
            is-active) [ "$(cat "$INTERLEX_ROOT/state" 2>/dev/null)" = active ] ;;
        esac`)
    mock("journalctl", ":")
    mock("npm", `
        echo "npm $*" >> "$INTERLEX_ROOT/events"
        if [ "$1" = ci ]; then mkdir node_modules; echo isolated > node_modules/keep; fi
        if [ "$1" = run ]; then
            [ "$SCENARIO" != build-fail ] || exit 1
            if [ "$SCENARIO" = build-signal ]; then kill -TERM "$PPID"; exit 1; fi
            mkdir .next; echo candidate-build > .next/BUILD_ID
        fi`)
    mock("npx", `
        case "$*" in
            *pending-schema*) [ "$SCENARIO" != migration-fail ] || echo auth ;;
            *'run.ts migrate'*)
                if [ "$SCENARIO" = migration-fail ]; then echo migrated > "$DB_DIR/auth.db"; exit 1; fi ;;
            *corpus-export*) echo changed ;;
        esac`)
    mock("sqlite3", `
        if [ "$2" = 'PRAGMA quick_check;' ]; then if [ "$SCENARIO" = bad-snapshot ]; then echo corrupt; else echo ok; fi
        else node -e 'const fs=require("fs"); const target=process.argv[2].split(String.fromCharCode(39))[1]; fs.copyFileSync(process.argv[1],target)' "$1" "$2"; fi`)
    // GNU atomic rename/readlink flags are unavailable on macOS. Emulate only
    // these OS primitives, using a real rename and real symlinks in the fixture.
    mock("mv", `
        if [ "$1" = -Tf ]; then
            node -e 'require("fs").renameSync(process.argv[1],process.argv[2])' "$2" "$3"
        else exec /bin/mv "$@"; fi`)
    mock("chmod", `if [[ "$1" = --reference=* ]]; then exit 0; else exec /bin/chmod "$@"; fi`)
    mock("chown", ":")
    mock("curl", `
        if [ -f "$INTERLEX_ROOT/current/.legacy-release" ]; then echo legacy; exit 0; fi
        if [ "$SCENARIO" = health-fail ]; then
            echo new-user-write > "$INTERLEX_ROOT/auth.db"; exit 22
        fi
        sha=$(git -C "$INTERLEX_ROOT/current" rev-parse HEAD)
        if [ "$SCENARIO" = wrong-sha ]; then sha=stale-process; fi
        echo "{\\"status\\":\\"ok\\",\\"release\\":\\"$sha\\"}"`)
    write("state", "active")
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: home, INTERLEX_ROOT: root, SCENARIO: scenario, INTERLEX_HEALTH_ATTEMPTS: "1", INTERLEX_PUBLIC_URL: "" }
    fs.copyFileSync(path.join(source, "rebuild-remote.sh"), path.join(stage, "rebuild-remote.sh"))
    const run = (args: string[] = []) => spawnSync("bash", [path.join(source, "scripts/ops/run-release.sh"), stage, `--commit=${commit}`, ...args], { env, encoding: "utf8", timeout: 15000 })
    return { root, stage, run, old, commit, git, env, read: (name: string) => fs.readFileSync(path.join(root, name), "utf8") }
}

describe("isolated release orchestration", () => {
    it("builds before stopping, switches a real symlink, preserves shared data and the old build", () => {
        const f = fixture("ok"), result = f.run()
        expect(result.status, result.stdout + result.stderr).toBe(0)
        const events = f.read("events")
        expect(events.indexOf("npm run build")).toBeLessThan(events.indexOf("systemctl stop"))
        expect(fs.realpathSync(path.join(f.root, "current"))).toContain(f.commit.slice(0, 12))
        expect(f.read("current/.next/BUILD_ID")).toBe("candidate-build\n")
        expect(f.read(".next/BUILD_ID")).toBe("legacy-build")
        expect(f.read("node_modules/keep")).toBe("live-dependencies")
        expect(f.read("auth.db")).toBe("original-data")
        expect(f.read("current/.env")).toBe("SECRET=server-only\n")
        expect(f.read("previous/.next/BUILD_ID")).toBe("legacy-build")
        const nextDir = path.join(f.root, "current/node_modules/next/dist/bin")
        fs.mkdirSync(nextDir, { recursive: true })
        fs.writeFileSync(path.join(nextDir, "next"), 'console.log(JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2),db:process.env.SQLITE_DB,release:process.env.RELEASE_COMMIT,covers:process.env.COVERS_DIR}))')
        const launch = spawnSync("bash", [path.join(source, "scripts/ops/start-release.sh"), "-p", "3010"], {
            encoding: "utf8", env: { ...f.env, COVERS_DIR: "/shared/real-covers" },
        })
        expect(launch.status, launch.stderr).toBe(0)
        expect(JSON.parse(launch.stdout)).toEqual({
            cwd: fs.realpathSync(path.join(f.root, "current")), args: ["start", "-p", "3010"],
            db: path.join(f.root, "interlex.db"), release: f.commit, covers: "/shared/real-covers",
        })
        expect(fs.existsSync(path.join(f.root, ".db-run.lock"))).toBe(false)
        expect(fs.readFileSync(path.join(f.stage, "result"), "utf8")).toBe("0\n")
    }, 30000)
    it.each(["build-fail", "build-signal", "locked"])("%s leaves the live process/build untouched", (scenario) => {
        const f = fixture(scenario), result = f.run()
        expect(result.status).not.toBe(0)
        expect(fs.existsSync(path.join(f.root, "events")) ? f.read("events") : "").not.toContain("systemctl stop")
        expect(f.read(".next/BUILD_ID")).toBe("legacy-build")
        expect(f.read("state")).toBe("active")
        expect(fs.existsSync(path.join(f.stage, "result"))).toBe(true)
    }, 30000)
    it("restores the pre-migration DB before restarting the old app", () => {
        const f = fixture("migration-fail"), result = f.run()
        expect(result.status, result.stdout + result.stderr).toBe(1)
        expect(result.stderr).toContain("ROLLBACK OK")
        expect(f.read("auth.db")).toBe("original-data")
        expect(f.read("state").trim()).toBe("active")
        expect(f.read("current/.legacy-release")).toBe("")
    }, 30000)
    it("rolls code back after failed readiness without erasing writes accepted by the candidate", () => {
        const f = fixture("health-fail"), result = f.run()
        expect(result.status, result.stdout + result.stderr).toBe(1)
        expect(result.stderr).toContain("ROLLBACK OK")
        expect(f.read("current/.legacy-release")).toBe("")
        expect(f.read("auth.db").trim()).toBe("new-user-write")
        expect(f.read("state").trim()).toBe("active")
    }, 30000)
    it("recovers if the candidate process fails to start", () => {
        const f = fixture("start-fail"), result = f.run()
        expect(result.status, result.stdout + result.stderr).toBe(1)
        expect(result.stderr).toContain("ROLLBACK OK")
        expect(f.read("current/.legacy-release")).toBe("")
        expect(f.read("state").trim()).toBe("active")
    }, 30000)
    it("supports another isolated release and a manual code rollback", () => {
        const f = fixture("ok")
        const first = f.run()
        expect(first.status, first.stdout + first.stderr).toBe(0)
        fs.writeFileSync(path.join(f.root, "release-marker"), "second")
        f.git("add", "release-marker"); f.git("commit", "-m", "second release"); f.git("push", "origin", "main")
        const secondCommit = f.git("rev-parse", "HEAD")
        const second = f.run([`--commit=${secondCommit}`])
        expect(second.status, second.stdout + second.stderr).toBe(0)
        expect(f.git("-C", path.join(f.root, "current"), "rev-parse", "HEAD")).toBe(secondCommit)
        expect(f.git("-C", path.join(f.root, "previous"), "rev-parse", "HEAD")).toBe(f.commit)
        fs.writeFileSync(path.join(f.root, "auth.db"), "new data after deploy")
        const rollback = f.run(["--rollback"])
        expect(rollback.status, rollback.stdout + rollback.stderr).toBe(0)
        expect(f.git("-C", path.join(f.root, "current"), "rev-parse", "HEAD")).toBe(f.commit)
        expect(f.read("auth.db")).toBe("new data after deploy")
    }, 30000)
    it("rolls back when the public proxy/asset check fails after local readiness", () => {
        const f = fixture("public-fail")
        f.env.INTERLEX_PUBLIC_URL = "http://stub.invalid"
        const result = f.run()
        expect(result.status, result.stdout + result.stderr).toBe(1)
        expect(result.stderr).toContain("ROLLBACK OK")
        expect(f.read("current/.legacy-release")).toBe("")
    }, 30000)
    it("refuses a stale process that responds with the wrong release identity", () => {
        const f = fixture("wrong-sha"), result = f.run()
        expect(result.status, result.stdout + result.stderr).toBe(1)
        expect(result.stderr).toContain("ROLLBACK OK")
    }, 30000)
    it("refuses a corrupt snapshot before stopping the app", () => {
        const f = fixture("bad-snapshot")
        fs.writeFileSync(path.join(f.stage, "corpus-release.db"), "corrupt")
        const result = f.run(["--db=corpus"])
        expect(result.status, result.stdout + result.stderr).toBe(1)
        expect(f.read("events")).not.toContain("systemctl stop")
        expect(f.read("corpus.db")).toBe("original-data")
    }, 30000)
    it("does not steal the lock of a running data job", () => {
        const f = fixture("ok")
        fs.writeFileSync(path.join(f.root, ".db-run.lock"), "99999")
        const result = f.run()
        expect(result.status, result.stdout + result.stderr).toBe(2)
        expect(f.read("events")).not.toContain("systemctl stop")
        expect(f.read(".db-run.lock")).toBe("99999")
    }, 30000)
    it("refuses a corpus snapshot when manual edits changed after export", () => {
        const f = fixture("ok")
        fs.writeFileSync(path.join(f.stage, "corpus-release.db"), "candidate-corpus")
        fs.writeFileSync(path.join(f.stage, "corpus-manual-export.json"), '{"counts":{"tokens":1}}')
        const result = f.run(["--db=corpus"])
        expect(result.status, result.stdout + result.stderr).toBe(1)
        expect(result.stderr).toContain("manual corpus edits changed")
        expect(result.stderr).toContain("ROLLBACK OK")
        expect(f.read("corpus.db")).toBe("original-data")
    }, 30000)
})
