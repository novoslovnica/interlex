// Две точечные правки словаря, согласованные с мейнтейнером 2026-08-24.
//
// 1. У лексемы ne-ADV стем равен "n" вместо "ne" — из-за этого движок строил
//    формы от однобуквенной основы. Найдено при разборе конкуренции лексем за
//    корпусные токены (scripts/db/find-competing-lexemes.ts).
//
// 2. 3 097 лексем (id 22411-25507) — блок битого импорта: ни стема, ни
//    значений, ни переводов. Из распознавания корпуса они уже исключены
//    (см. HAS_MEANING в lib/corpus/tokenizer/analyzer-factory.ts), но
//    isPublic=1 оставлял их в публичном словаре карточками, в которых нечего
//    показать. Проставляем isPublic=0 — строки остаются, их видно в админке,
//    и решение обратимо. НЕ удаляем: возможно, это заготовка на доработку.
//    Блок определяется не диапазоном id, а отсутствием значений — на текущих
//    данных это одно и то же (у каждой лексемы со стемом есть хотя бы одно
//    значение, исключений ноль), но условие по смыслу надёжнее.
//
// Обе правки идемпотентны и пишутся в AuditLog.
//
// Usage: npx tsx -r dotenv/config scripts/db/2026-08-24-fix-dictionary-defects.ts [--apply]

import { prismaData } from "@/lib/prisma"
import { logAudit } from "@/lib/audit-log"

async function fixNeAdvStem(apply: boolean) {
    const lexeme = await prismaData.lexeme.findFirst({ where: { slug: "ne-ADV" }, select: { id: true, stem: true } })
    if (!lexeme) {
        console.log("1. ne-ADV: лексема не найдена, пропуск")
        return
    }
    if (lexeme.stem === "ne") {
        console.log("1. ne-ADV: стем уже 'ne', ничего не делаем")
        return
    }
    console.log(`1. ne-ADV: стем "${lexeme.stem}" -> "ne"`)
    if (!apply) return

    await prismaData.lexeme.update({ where: { id: lexeme.id }, data: { stem: "ne" } })
    await logAudit(undefined, "Lexeme", lexeme.id, [{ field: "stem", oldValue: lexeme.stem, newValue: "ne" }])
}

async function hideMeaninglessLexemes(apply: boolean) {
    const doomed = await prismaData.lexeme.findMany({
        where: { isPublic: true, meanings: { none: {} } },
        select: { id: true },
    })
    console.log(`2. Лексем без единого значения и всё ещё публичных: ${doomed.length}`)
    if (doomed.length === 0 || !apply) return

    const result = await prismaData.lexeme.updateMany({
        where: { id: { in: doomed.map((l) => l.id) } },
        data: { isPublic: false },
    })
    console.log(`   Скрыто: ${result.count}`)
    // Один AuditLog на всю операцию, а не 3 097 записей: это одна
    // административная правка, а не редактирование каждого слова по
    // отдельности.
    await logAudit(undefined, "Lexeme", doomed[0].id, [
        { field: "isPublic.bulkHideMeaninglessLexemes", oldValue: `${result.count} строк: true`, newValue: "false" },
    ])
}

async function main() {
    const apply = process.argv.includes("--apply")
    await fixNeAdvStem(apply)
    await hideMeaninglessLexemes(apply)
    if (!apply) console.log("\nЭто прогон вхолостую. Повторите с --apply, чтобы записать.")
}

main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prismaData.$disconnect())
