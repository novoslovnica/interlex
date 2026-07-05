export enum MorphemeType {
  ROOT = 0,
  PREFIX = 1,
  SUFFIX = 2,
  UNKNOWN = 3,
}

export const ALL_MORPHEME_VALUES = Object.values(MorphemeType).filter(v => typeof v === 'number') as MorphemeType[];

export interface MorphemePart {
  type: MorphemeType;
  text: string;
}