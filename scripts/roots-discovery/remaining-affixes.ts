interface AffixModel {
  type: 1 | 2
  value: string
  markers: readonly string[]
  registryValues: readonly string[]
  origin: "slavic" | "borrowed"
  searchPos?: readonly string[]
}

const nouns = ["NOUN"]
const adjectives = ["ADJ"]
const verbs = ["VERB"]
const adverbs = ["ADV"]
const indefinites = ["PRON", "ADV", "ADJ", "NUM", "PART"]

function prefix(
  value: string,
  markers: readonly string[] = [value],
  searchPos: readonly string[] = verbs,
  origin: AffixModel["origin"] = "slavic",
): AffixModel {
  return { type: 1, value, markers, registryValues: markers, origin, searchPos }
}

function suffix(
  value: string,
  markers: readonly string[],
  searchPos: readonly string[],
  registryValues: readonly string[] = markers,
  origin: AffixModel["origin"] = "slavic",
): AffixModel {
  return { type: 2, value, markers, registryValues, origin, searchPos }
}

function borrowedSuffix(value: string, markers: readonly string[] = [value], pos = nouns): AffixModel {
  return suffix(value, markers, pos, markers, "borrowed")
}

// The 67 models from the project inventory. Markers retrieve spelling matches;
// registryValues identify possible typed records without folding different affixes together.
export const remainingAffixes: readonly AffixModel[] = [
  prefix("nedo"),
  prefix("o", ["o", "ob"]),
  prefix("obez"),
  prefix("prěd", ["prěd", "pred"]),
  prefix("s", ["s", "so"]),
  prefix("su"),
  prefix("u"),
  prefix("v", ["v", "vo"]),
  prefix("voz"),
  prefix("vy"),
  prefix("među", ["među", "medžu", "medzu", "medu"], [...nouns, ...adjectives]),
  prefix("pra", ["pra"], nouns),
  prefix("ně", ["ně"], indefinites),
  suffix("ok", ["ok", "ek"], nouns),
  suffix("ik", ["ik"], nouns),
  suffix("ko", ["ko"], nouns),
  suffix("išče", ["išče", "isce", "ište", "iste"], nouns),
  suffix("je", ["je"], nouns),
  suffix("nica", ["nica"], nouns),
  suffix("ica", ["ica"], nouns),
  suffix("anin", ["anin", "janin", "jan", "an"], nouns),
  suffix("ę", ["ę", "et"], nouns),
  suffix("ač", ["ač", "ac"], nouns),
  suffix("ca", ["ca"], nouns),
  suffix("ić", ["ić", "ic"], nouns),
  suffix("ota", ["ota"], nouns),
  suffix("nje", ["nje", "tje", "ńe", "ťe"], nouns),
  suffix("ina", ["ina"], nouns),
  suffix("oba", ["oba"], nouns),
  suffix("ilo", ["ilo"], nouns),
  suffix("aj", ["aj"], nouns),
  suffix("ščina", ["ščina", "scina", "ština", "stina"], nouns),
  suffix("ba", ["ba"], nouns, ["ba", "b"]),
  suffix("sky", ["sky", "ski"], adjectives, ["sky", "ski", "sk"]),
  suffix("ji", ["ji"], adjectives),
  suffix("ěny", ["ěny", "eny", "any"], adjectives),
  suffix("ovy", ["ovy", "evy"], adjectives, ["ovy", "evy", "ov", "ev"]),
  suffix("ovity", ["ovity", "evity"], adjectives),
  suffix("isty", ["isty"], adjectives),
  suffix("in", ["in", "iny", "ini", "ina", "ino"], adjectives, ["in"]),
  suffix("livy", ["livy"], adjectives, ["livy", "liv"]),
  suffix("omy", ["omy", "emy", "imy"], adjectives),
  suffix("šnji", ["šnji", "snji", "sny"], adjectives),
  suffix("ovati", ["ovati", "evati"], verbs, ["ovati", "evati", "ova", "eva"]),
  suffix("iti", ["iti"], verbs, ["iti", "i"]),
  suffix("ěti", ["ěti", "eti"], verbs, ["ěti", "eti", "ě"]),
  suffix("yvati", ["yvati", "ivati"], verbs, ["yvati", "ivati", "yva", "iva"]),
  suffix("vati", ["vati"], verbs, ["vati", "va"]),
  suffix("o", ["o", "e"], adverbs),
  suffix("koli", ["koli"], indefinites),
  prefix("anti", ["anti"], [], "borrowed"),
  prefix("de", ["de"], [], "borrowed"),
  borrowedSuffix("ija"),
  borrowedSuffix("acija"),
  borrowedSuffix("izm"),
  borrowedSuffix("ist"),
  borrowedSuffix("or"),
  borrowedSuffix("ant", ["ant", "ent"]),
  borrowedSuffix("ura"),
  borrowedSuffix("ika"),
  borrowedSuffix("oid"),
  borrowedSuffix("ičny", ["ičny", "icny"], adjectives),
  borrowedSuffix("aľny", ["aľny", "alny"], adjectives),
  borrowedSuffix("ijny", ["ijny"], adjectives),
  borrowedSuffix("ivny", ["ivny"], adjectives),
  borrowedSuffix("ozny", ["ozny"], adjectives),
  borrowedSuffix("ar", ["ar", "arj"]),
]
