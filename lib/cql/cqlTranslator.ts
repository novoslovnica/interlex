import { CqlAST, CqlSegment } from '@/types/cql';

interface ParameterizedSQL {
    query: string;
    params: (string | number)[];
}

export class CqlTranslator {
    /**
     * Преобразует AST в параметризованный SQL-запрос для SQLite/PostgreSQL
     */
    public static toSQL(ast: CqlAST): ParameterizedSQL {
        const { segments } = ast;

        if (segments.length === 0) {
            throw new Error("Cannot translate an empty CQL query.");
        }

        const joins: string[] = [];
        const whereConditions: string[] = [];
        const params: (string | number)[] = [];

        // Базовый алиас для первого сегмента
        const baseTable = 't0';

        // 1. Проходим по всем сегментам для построения JOIN и WHERE условий
        segments.forEach((segment, index) => {
            const currentTable = `t${index}`;

            // Для всех таблиц, начиная со второй (t1, t2...), строим JOIN по цепочке к предыдущей
            if (index > 0) {
                const prevTable = `t${index - 1}`;
                joins.push(
                    `JOIN "CorpusToken" ${currentTable} ON ` +
                    `${currentTable}."sentenceId" = ${prevTable}."sentenceId" AND ` +
                    `${currentTable}."tokenIndex" = ${prevTable}."tokenIndex" + 1`
                );
            }

            // Разбираем внутренние атрибуты сегмента (н-р: pos="ADJ")
            segment.attributes.forEach((attr) => {
                // Защита от SQL-инъекций на уровне имен колонок (белый список)
                const allowedColumns = ['lemma', 'pos', 'surfaceForm'];

                let columnName = attr.name;
                let isJsonField = false;

                if (!allowedColumns.includes(columnName)) {
                    // Если поле не в белом списке, трактуем его как грамматический признак внутри Json (feats)
                    // Поддерживает синтаксис SQLite для извлечения JSON: json_extract(feats, '$.gender')
                    columnName = `json_extract(${currentTable}."feats", '$.${attr.name}')`;
                    isJsonField = true;
                } else {
                    columnName = `${currentTable}."${columnName}"`;
                }

                // Обработка операторов
                const sqlOp = attr.operator === '!=' ? '!=' : '=';

                if (isJsonField) {
                    whereConditions.push(`${columnName} ${sqlOp} ?`);
                } else {
                    // Для обычных текстовых полей делаем поиск регистронезависимым через LOWER
                    whereConditions.push(`LOWER(${columnName}) ${sqlOp} LOWER(?)`);
                }

                params.push(attr.value);
            });
        });

        // 2. Сборка финального SQL-запроса
        // Выбираем диапазоны индексов токенов и ID предложения, чтобы KWIC мог вырезать контекст
        const selectClause = `
      SELECT 
        t0."sentenceId", 
        t0."documentSlug",
        t0."tokenIndex" AS "matchStart", 
        t${segments.length - 1}."tokenIndex" AS "matchEnd"
      FROM "CorpusToken" t0
    `.trim();

        const joinClause = joins.length > 0 ? joins.join('\n      ') : '';
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const finalQuery = `
      ${selectClause}
      ${joinClause}
      ${whereClause}
      ORDER BY t0."id" ASC
    `.trim().replace(/\s+/g, ' '); // Схлопываем лишние пробелы

        return {
            query: finalQuery,
            params
        };
    }
}
