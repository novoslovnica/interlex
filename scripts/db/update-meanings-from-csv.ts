import * as fs from 'fs';
import * as path from 'path';

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), 'interlex.db')}`

function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ';') {
                fields.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    fields.push(current);
    return fields;
}

function parseFullCsv(text: string): string[][] {
    const rows: string[][] = [];
    let inQuotes = false;
    let start = 0;

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '"') {
            inQuotes = !inQuotes;
        }
        if (!inQuotes && text[i] === '\n') {
            const line = text.slice(start, i);
            if (line.trim()) {
                rows.push(parseCsvLine(line));
            }
            start = i + 1;
        }
    }
    const last = text.slice(start).trim();
    if (last) {
        rows.push(parseCsvLine(last));
    }
    return rows;
}

function appendText(existing: string | null | undefined, incoming: string): string {
    if (!incoming) return existing ?? '';
    if (existing) {
        return existing + '\n' + incoming;
    }
    return incoming;
}

async function main(): Promise<void> {
    const { prismaData: prisma } = await import('@/lib/prisma')

    const csvPath = process.argv[2];
    if (!csvPath) {
        console.error('Укажите путь к CSV файлу: npx tsx scripts/db/update-meanings-from-csv.ts <путь к csv>');
        process.exit(1);
    }

    if (!fs.existsSync(csvPath)) {
        console.error(`Файл не найден: ${csvPath}`);
        process.exit(1);
    }

    const raw = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseFullCsv(raw);

    console.log(`Загружено строк: ${rows.length}`);

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const row of rows) {
        // 4 колонки: meaningId, lexemeValue, meaning, examples
        // 5 колонок: meaningId, morphData, lexemeValue, meaning, examples
        const colCount = row.length;
        // if (colCount !== 4 && colCount !== 5) {
        //     console.warn(`Пропуск строки с ${colCount} колонками: ${row.join(',')}`);
        //     errors++;
        //     continue;
        // }

        const meaningIdStr = row[0].trim();
        const meaningId = parseInt(meaningIdStr, 10);
        if (isNaN(meaningId)) {
            console.warn(`Неверный meaningId: "${meaningIdStr}"`);
            errors++;
            continue;
        }

        const incomingMeaning = new Array(colCount - 2).fill(0).map(el => el)
            .map((el, index) => row[index + 2].trim())
            .join(';')
        const incomingExamples = row[colCount - 1].trim();

        if (!incomingMeaning && !incomingExamples) {
            continue;
        }

        const existing = await prisma.meaning.findUnique({ where: { id: meaningId } });

        if (!existing) {
            console.warn(`Meaning id=${meaningId} не найден`);
            notFound++;
            continue;
        }

        await prisma.meaning.update({
            where: { id: meaningId },
            data: {
                meaning: appendText(existing.meaning, incomingMeaning),
                examples: appendText(existing.examples, incomingExamples),
                meaningVeryfied: 0,
                examplesVeryfied: 0,
            },
        });

        updated++;
    }

    console.log('\nРезультаты:');
    console.log(`  Обновлено: ${updated}`);
    console.log(`  Не найдено: ${notFound}`);
    console.log(`  Ошибок: ${errors}`);
}

main()
    .catch((e: Error) => {
        console.error('Ошибка:', e.message);
        process.exit(1);
    });