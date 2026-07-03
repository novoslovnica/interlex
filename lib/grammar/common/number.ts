export enum GrammaticalNumber {
    SINGULAR = 'sg',
    PLURAL = 'pl',
    DUAL = 'du',
}

export const ALL_NUMBER_VALUES = Object.values(GrammaticalNumber) as string[];

export function isValidNumber(value: string | null | undefined): value is GrammaticalNumber {
    if (!value) return false;
    return ALL_NUMBER_VALUES.includes(value.toLowerCase());
}