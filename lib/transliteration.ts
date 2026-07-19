import { isvToCyr, standardToSimple, standardToSimpleCyr } from "./isv"
import { mapNslToEtymologized, mapNslToStandard } from "./nsl"

export type Script =
  | "etym_lat"
  | "etym_cyr"
  | "std_lat"
  | "std_cyr"
  | "simple_lat"
  | "simple_cyr"

export const SCRIPT_LABELS: Record<Script, string> = {
  etym_lat: "Этимологический (научный), латиница",
  etym_cyr: "Этимологический (научный), кириллица",
  std_lat: "Стандартный, латиница",
  std_cyr: "Стандартный, кириллица",
  simple_lat: "Простой, латиница",
  simple_cyr: "Простой, кириллица",
}

function isCyrillic(text: string): boolean {
  return /[а-яѢѣѦѧѪѫ]/i.test(text)
}

export function detectScript(text: string): Script | null {
  if (!text) return null
  const hasHistorical = /[ěěęęǫǫ]/i.test(text) || /[ѢѣѦѧѪѫ]/.test(text)
  const hasCyr = isCyrillic(text)
  const hasJBeforeVowel = /j[aeou]/i.test(text)
  const hasIBeforeVowel = /i[aeouаеоу]/i.test(text)

  if (hasCyr) {
    if (hasHistorical) return "etym_cyr"
    if (hasIBeforeVowel && !hasJBeforeVowel) return "simple_cyr"
    return "std_cyr"
  }

  if (hasHistorical) return "etym_lat"
  if (hasJBeforeVowel) return "std_lat"
  if (hasIBeforeVowel) return "simple_lat"
  return "std_lat"
}

export function etymCyrToEtymLat(text: string): string {
  if (!text) return ""

  const processed = text
    .replace(/Џ/g, 'Dž').replace(/џ/g, 'dž')
    .replace(/Щ/g, 'Št').replace(/щ/g, 'št')
    .replace(/Ќ/g, 'Ks').replace(/ќ/g, 'ks')

  const rules: Record<string, string> = {
    'Б': 'B', 'б': 'b', 'В': 'V', 'в': 'v', 'Г': 'G', 'г': 'g',
    'Ґ': 'G', 'ґ': 'g', 'Д': 'D', 'д': 'd', 'Ж': 'Ž', 'ж': 'ž',
    'З': 'Z', 'з': 'z', 'П': 'P', 'п': 'p', 'Ф': 'F', 'ф': 'f',
    'Х': 'H', 'х': 'h', 'К': 'K', 'к': 'k', 'Т': 'T', 'т': 't',
    'Ч': 'Č', 'ч': 'č', 'Ш': 'Š', 'ш': 'š', 'С': 'S', 'с': 's',
    'Ц': 'C', 'ц': 'c', 'Л': 'L', 'л': 'l', 'М': 'M', 'м': 'm',
    'Н': 'N', 'н': 'n', 'Р': 'R', 'р': 'r',
    'А': 'A', 'а': 'a', 'Е': 'E', 'е': 'e', 'И': 'I', 'и': 'i',
    'О': 'O', 'о': 'o', 'У': 'U', 'у': 'u', 'Ы': 'Y', 'ы': 'y',
    'І': 'J', 'і': 'j',
    'Ѣ': 'Ě', 'ѣ': 'ě',
    'Ѧ': 'Ę', 'ѧ': 'ę',
    'Ѫ': 'Ǫ', 'ѫ': 'ǫ',
  }

  let result = ""
  for (let i = 0; i < processed.length; i++) {
    const char = processed[i]
    result += rules[char] ?? char
  }

  const softVowels: Record<string, [string, string]> = {
    'Я': ['Ja', 'A'], 'я': ['ja', 'a'],
    'Ю': ['Ju', 'U'], 'ю': ['ju', 'u'],
    'Є': ['Je', 'E'], 'є': ['je', 'e'],
    'Ё': ['Jo', 'O'], 'ё': ['jo', 'o'],
  }

  let final = ""
  for (let i = 0; i < result.length; i++) {
    const char = result[i]
    if (softVowels[char]) {
      const lastChar = final.length > 0 ? final[final.length - 1].toLowerCase() : ''
      if (lastChar === 'i' || lastChar === 'j') {
        final += softVowels[char][1]
      } else {
        final += softVowels[char][0]
      }
    } else {
      final += char
    }
  }

  return final.toLowerCase()
}

function etymLatToStdLat(text: string): string {
  if (!text) return ""
  return text
    .replace(/[ĚĘ]/g, 'E').replace(/[ěę]/g, 'e')
    .replace(/[Ǫ]/g, 'U').replace(/[ǫ]/g, 'u')
}

function etymLatToStdCyr(text: string): string {
  if (!text) return ""
  const cyr = isvToCyr(text)
  return cyr
    .replace(/[ѢѦ]/g, 'Е').replace(/[ѣѧ]/g, 'е')
    .replace(/[Ѫ]/g, 'У').replace(/[ѫ]/g, 'у')
}

function stdCyrToEtymLat(text: string): string {
  return mapNslToEtymologized(text)
}

function stdLatToEtymLat(text: string): string {
  return text
}

function simpleLatToEtymLat(text: string): string {
  if (!text) return ""
  let result = ""
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if ((char === 'i' || char === 'I') && i < text.length - 1) {
      const next = text[i + 1].toLowerCase()
      if (['a', 'e', 'o', 'u'].includes(next)) {
        result += 'j'
        continue
      }
    }
    result += char
  }
  return result.toLowerCase()
}

function simpleCyrToEtymLat(text: string): string {
  if (!text) return ""
  const asLat = etymCyrToEtymLat(text)
  let result = ""
  for (let i = 0; i < asLat.length; i++) {
    const char = asLat[i]
    if (char === 'i' && i < asLat.length - 1) {
      const next = asLat[i + 1].toLowerCase()
      if (['a', 'e', 'o', 'u'].includes(next)) {
        result += 'j'
        continue
      }
    }
    result += char
  }
  return result.toLowerCase()
}

const TO_HUB: Record<Script, (text: string) => string> = {
  etym_lat: (t) => t.toLowerCase(),
  etym_cyr: etymCyrToEtymLat,
  std_lat: stdLatToEtymLat,
  std_cyr: stdCyrToEtymLat,
  simple_lat: simpleLatToEtymLat,
  simple_cyr: simpleCyrToEtymLat,
}

const FROM_HUB: Record<Script, (text: string) => string> = {
  etym_lat: (t) => t.toLowerCase(),
  etym_cyr: isvToCyr,
  std_lat: etymLatToStdLat,
  std_cyr: etymLatToStdCyr,
  simple_lat: standardToSimple,
  simple_cyr: standardToSimpleCyr,
}

export function convert(text: string, from: Script, to: Script): string {
  if (!text || from === to) return text
  const hubForm = TO_HUB[from](text)
  return FROM_HUB[to](hubForm)
}