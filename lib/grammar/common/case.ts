export enum GrammaticalCase {
    NOM = 'nom',
    ACC = 'acc',
    GEN = 'gen',
    DAT = 'dat',
    LOC = 'loc',
    INS = 'ins',
    VOC = 'voc',
}

export const ALL_CASE_VALUES = Object.values(GrammaticalCase) as string[];

export function isValidCase(value: string | null | undefined): value is GrammaticalCase {
    if (!value) return false;
    return ALL_CASE_VALUES.includes(value.toLowerCase());
}