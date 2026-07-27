/**
 * Оркестратор полного пакетного пайплайна RuWordNet — заменяет три ручных шага
 * одной командой. Логика самих шагов не меняется, только последовательный
 * запуск с остановкой на первой ошибке:
 *   1. scripts/make-json-for-python.ts — выгружает все лексемы с русским
 *      переводом из interlex.db в scripts/python/words.json (свежий срез на
 *      каждый запуск — новые слова подхватываются автоматически).
 *   2. scripts/python/process_words.py (в venv) — сопоставляет с RuWordNet,
 *      пишет scripts/python/words_enriched.json.
 *   3. scripts/db/upload-ruwordnet.ts — additive Synset/MeaningSynset +
 *      scoped-delete-and-reinsert semantic_relations (source='ruwordnet_auto'
 *      only, 'manual' строки не трогает).
 *
 * Запуск: npm run refresh:ruwordnet
 */
import { execFileSync } from "child_process"
import * as path from "path"
import * as fs from "fs"

const ROOT = process.cwd()
const PYTHON_DIR = path.join(ROOT, "scripts", "python")
const VENV_PYTHON = path.join(PYTHON_DIR, ".venv", "bin", "python")

function step(title: string, fn: () => void) {
    console.log(`\n=== ${title} ===`)
    fn()
}

function runNode(scriptPath: string) {
    execFileSync("npx", ["tsx", scriptPath], { stdio: "inherit", cwd: ROOT })
}

function main() {
    if (!fs.existsSync(VENV_PYTHON)) {
        console.error(
            `Не найден Python venv по пути ${VENV_PYTHON}.\n` +
            `Ожидается окружение с установленным пакетом ruwordnet (см. scripts/python/requirements.txt).\n` +
            `Создайте его: cd scripts/python && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
        )
        process.exit(1)
    }

    step("1/3 Выгрузка лексем с русским переводом (make-json-for-python.ts)", () => {
        runNode(path.join(ROOT, "scripts", "make-json-for-python.ts"))
    })

    step("2/3 Сопоставление с RuWordNet (process_words.py)", () => {
        execFileSync(VENV_PYTHON, ["process_words.py"], { stdio: "inherit", cwd: PYTHON_DIR })
    })

    step("3/3 Загрузка результатов в interlex.db (upload-ruwordnet.ts)", () => {
        runNode(path.join(ROOT, "scripts", "db", "upload-ruwordnet.ts"))
    })

    console.log("\nГотово.")
}

main()
