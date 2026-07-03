import { CqlAST, CqlSegment, CqlAttribute, CqlOperator } from '@/types/cql';

export class CqlParser {
    /**
     * Главный метод: преобразует строку CQL в AST.
     * Выбрасывает типизированную ошибку при синтаксическом сбое.
     */
    public static parse(cqlString: string): CqlAST {
        const trimmed = cqlString.trim();
        if (!trimmed) {
            return { segments: [] };
        }

        // Регулярное выражение для поиска блоков внутри квадратных скобок: [ ... ]
        const segmentRegex = /\[([^\]]+)\]/g;
        const segments: CqlSegment[] = [];

        let match: RegExpExecArray | null;
        let lastIndex = 0;

        while ((match = segmentRegex.exec(trimmed)) !== null) {
            // Проверка на мусор между сегментами (например, пропущенные пробелы или некорректные символы)
            const gap = trimmed.substring(lastIndex, match.index).trim();
            if (gap.length > 0) {
                throw new Error(`Syntax error: Unexpected token "${gap}" outside of brackets.`);
            }

            const insideBrackets = match[1].trim();
            const attributes = this.parseAttributes(insideBrackets);

            segments.push({ attributes });
            lastIndex = segmentRegex.lastIndex;
        }

        if (lastIndex < trimmed.length) {
            const trailing = trimmed.substring(lastIndex).trim();
            if (trailing.length > 0) {
                throw new Error(`Syntax error: Trailing garbage "${trailing}" at the end of query.`);
            }
        }

        if (segments.length === 0) {
            throw new Error("Syntax error: Invalid CQL query. Must contain at least one [segment].");
        }

        return { segments };
    }

    /**
     * Разбор условий внутри одного сегмента: pos="ADJ" & lemma="dom"
     */
    private static parseAttributes(insideBrackets: string): CqlAttribute[] {
        // Делим по амперсанду (логическое И). В будущем можно расширить до | (ИЛИ)
        const pairs = insideBrackets.split('&').map(p => p.trim());
        const attributes: CqlAttribute[] = [];

        // Регулярное выражение для разбора: ключ оператор "значение"
        // Поддерживает операторы =, !=
        const attrRegex = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(=|!=)\s*"([^"]*)"$/;

        for (const pair of pairs) {
            const match = attrRegex.exec(pair);
            if (!match) {
                throw new Error(`Syntax error inside segment: "${pair}" is not a valid attribute expression.`);
            }

            const [, name, op, value] = match;

            attributes.push({
                name,
                operator: op as CqlOperator,
                value
            });
        }

        return attributes;
    }
}
