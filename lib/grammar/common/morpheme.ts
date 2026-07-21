import { applyFirstPalatalization, applyIotation } from '../morphonology';
import { removeFleetingVowel } from './stem-candidates';

export enum MorphemeType {
  ROOT = 0,
  PREFIX = 1,
  SUFFIX = 2,
  UNKNOWN = 3,
  ENDING = 4,
}

export const ALL_MORPHEME_VALUES = Object.values(MorphemeType).filter(v => typeof v === 'number') as MorphemeType[];

export interface MorphemePart {
  type: MorphemeType;
  text: string;
}

export function generateMorphemeCandidates(value: string, type?: number): string[] {
  if (!value) return [];
  const candidates = new Set<string>();
  const v = value.toLowerCase();

  candidates.add(v);

  const palatalized = applyFirstPalatalization(v);
  if (palatalized !== v) candidates.add(palatalized);

  const iotated = applyIotation(v);
  if (iotated !== v && iotated !== palatalized) candidates.add(iotated);

  const withoutFleeting = removeFleetingVowel(v);
  if (withoutFleeting) {
    candidates.add(withoutFleeting);
    const palFleeting = applyFirstPalatalization(withoutFleeting);
    if (palFleeting !== withoutFleeting) candidates.add(palFleeting);
  }

  if (type === MorphemeType.PREFIX && v.endsWith('z')) {
    candidates.add(v.slice(0, -1) + 's');
  }

  return [...candidates];
}