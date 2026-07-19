import {isvToCyr} from "@/lib/isv";

export const ScriptMode = {
  CYRILLIC: "CYRILLIC",
  LATIN: "LATIN",
} as const

export type ScriptMode = (typeof ScriptMode)[keyof typeof ScriptMode]

export const writeOrTranslate = (word: string, script: ScriptMode) => {
  return script === ScriptMode.CYRILLIC
      ? isvToCyr(word)
      : word;
};

export const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);