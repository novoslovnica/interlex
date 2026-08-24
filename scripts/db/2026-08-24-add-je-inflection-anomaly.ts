// Привязывает форму "je" (3sg наст. вр. от "byti") к лексеме byti-VERB
// строкой в inflection_anomalies — рядом с уже имеющимися jesm/jesi/jest/
// jesmo/jeste/sųt/byl/bųdų.
//
// Зачем: "je" — самая частая нераспознанная словоформа корпуса (34 184
// вхождения). Она суппletивная — из стема "by-" никаким сложением
// окончания не выводится, ровно тот случай, для которого таблица аномалий
// и существует (см. AGENTS.md, «InflectionAnomaly was write-only»). Без
// этой строки "je" разбиралась как jě-verb («есть, кушать») — формально
// возможный омоним, но не то, что имеется в виду в 34 тысячах случаев.
// Решение согласовано с мейнтейнером 2026-08-24.
//
// Идемпотентен: строка добавляется только если её ещё нет.
//
// Usage: npx tsx -r dotenv/config scripts/db/2026-08-24-add-je-inflection-anomaly.ts

import { prismaData } from "@/lib/prisma"

const LEXEME_SLUG = "byti-VERB"
const INFLECTION = "je"
const GRAMMEME = "PRES"

async function main() {
    const lexeme = await prismaData.lexeme.findFirst({ where: { slug: LEXEME_SLUG }, select: { id: true } })
    if (!lexeme) {
        console.error(`Лексема ${LEXEME_SLUG} не найдена — ничего не сделано.`)
        process.exit(1)
    }

    const existing = await prismaData.inflectionAnomaly.findMany({
        where: { lexemeId: lexeme.id, inflection: INFLECTION, grammeme: GRAMMEME },
        select: { id: true },
    })
    if (existing.length > 0) {
        console.log(`Уже есть (${existing.length} строк) — ничего не добавлено.`)
        return
    }

    const created = await prismaData.inflectionAnomaly.create({
        data: { lexemeId: lexeme.id, inflection: INFLECTION, grammeme: GRAMMEME },
    })
    console.log(`Добавлено: id=${created.id} ${LEXEME_SLUG} "${INFLECTION}" (${GRAMMEME})`)
}

main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prismaData.$disconnect())
