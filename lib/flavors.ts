import { isvToCyr } from "./isv"

const E = (s: string) => s.replace(/Ě/g, "E").replace(/ě/g, "e")

export function generateEastFlavor(core: string): string {
  const cyr = isvToCyr(core)
  return cyr
    .replace(/Ѣ/g, "Е").replace(/ѣ/g, "е")
    .replace(/Ѧ/g, "Я").replace(/ѧ/g, "я")
    .replace(/Ѫ/g, "У").replace(/ѫ/g, "у")
}

export function generateWestFlavor(core: string): string {
  return E(core)
    .replace(/Ę/g, "E").replace(/ę/g, "e")
    .replace(/Ǫ/g, "O").replace(/ǫ/g, "o")
}

export function generateSouthFlavor(core: string): string {
  const cyr = isvToCyr(core)
  return cyr
    .replace(/Ѣ/g, "Е").replace(/ѣ/g, "е")
    .replace(/Ѧ/g, "Е").replace(/ѧ/g, "е")
    .replace(/Ѫ/g, "А").replace(/ѫ/g, "а")
}

export function generateAllFlavors(core: string): Record<string, string> {
  return {
    core,
    nsl: isvToCyr(core),
    east: generateEastFlavor(core),
    west: generateWestFlavor(core),
    south: generateSouthFlavor(core),
  }
}