export type CqlOperator = '=' | '!=' | 'contains';

export interface CqlAttribute {
    name: string;       // например: 'lemma', 'pos', 'surfaceForm'
    operator: CqlOperator;
    value: string;      // например: 'dom', 'NOUN'
}

export interface CqlSegment {
    // Массив условий внутри одних скобок [pos="ADJ" & gender="masc"]
    // Пока закладываем AND-логику объединения условий внутри сегмента
    attributes: CqlAttribute[];
    isOptional?: boolean; // Для будущей поддержки квантификаторов вроде [pos="ADJ"]?
}

export interface CqlAST {
    segments: CqlSegment[];
}
