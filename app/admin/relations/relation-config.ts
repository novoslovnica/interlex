export interface RelationConfig {
  label: string
  labelSingle: string
  labelSingleShort: string
  /** relationType value in the consolidated `semantic_relations` table (2026-07-23). */
  relationType: string
  /**
   * Symmetric types (undefined): order doesn't matter, sourceId/targetId are
   * normalized on write — see lib/relations.ts's fetchSymmetricSemanticRelations.
   * Directional types: "outgoing" = this meaning is sourceId (e.g. "hypernyms
   * of X" — X points up to its more general concept), "incoming" = this
   * meaning is targetId (e.g. "hyponyms of X" — things pointing up to X).
   */
  direction?: "outgoing" | "incoming"
  navHref: string
  featureKey: string
  color: string
  description: string
}

export type RelationType =
  | "hypernyms"
  | "hyponyms"
  | "meronyms"
  | "holonyms"
  | "related-words"
  | "causes"
  | "effects"
  | "premises"
  | "conclusions"
  | "pos-synonyms"
  | "instance-of"
  | "instances"
  | "derivation-targets"
  | "derivation-sources"

export const RELATION_CONFIG: Record<RelationType, RelationConfig> = {
  hypernyms: {
    label: "Гиперонимы",
    labelSingle: "гипероним",
    labelSingleShort: "гип.",
    relationType: "hypernymy",
    direction: "outgoing",
    navHref: "/admin/relations/hypernyms",
    featureKey: "hypernyms_edit",
    color: "blue",
    description: "привязать родовые понятия (IS-A parent)",
  },
  hyponyms: {
    label: "Гипонимы",
    labelSingle: "гипоним",
    labelSingleShort: "ип.",
    relationType: "hypernymy",
    direction: "incoming",
    navHref: "/admin/relations/hyponyms",
    featureKey: "hyponyms_edit",
    color: "purple",
    description: "привязать видовые понятия (IS-A child)",
  },
  meronyms: {
    label: "Меронимы",
    labelSingle: "мероним",
    labelSingleShort: "мер.",
    relationType: "meronymy",
    direction: "incoming",
    navHref: "/admin/relations/meronyms",
    featureKey: "meronyms_edit",
    color: "green",
    description: "привязать части (part-of)",
  },
  holonyms: {
    label: "Холонимы",
    labelSingle: "холоним",
    labelSingleShort: "хол.",
    relationType: "meronymy",
    direction: "outgoing",
    navHref: "/admin/relations/holonyms",
    featureKey: "holonyms_edit",
    color: "orange",
    description: "привязать целое (has-part)",
  },
  "related-words": {
    label: "Связанные слова",
    labelSingle: "связанное",
    labelSingleShort: "свз.",
    relationType: "related",
    navHref: "/admin/relations/related-words",
    featureKey: "related_words_edit",
    color: "slate",
    description: "привязать связанные понятия",
  },
  causes: {
    label: "Причины",
    labelSingle: "причина",
    labelSingleShort: "прч.",
    relationType: "causation",
    direction: "incoming",
    navHref: "/admin/relations/causes",
    featureKey: "causes_edit",
    color: "amber",
    description: "глагольные причины",
  },
  effects: {
    label: "Следствия",
    labelSingle: "следствие",
    labelSingleShort: "слд.",
    relationType: "causation",
    direction: "outgoing",
    navHref: "/admin/relations/effects",
    featureKey: "effects_edit",
    color: "rose",
    description: "глагольные следствия",
  },
  premises: {
    label: "Предпосылки",
    labelSingle: "предпосылка",
    labelSingleShort: "прд.",
    relationType: "entailment",
    direction: "incoming",
    navHref: "/admin/relations/premises",
    featureKey: "premises_edit",
    color: "teal",
    description: "глагольные предпосылки",
  },
  conclusions: {
    label: "Заключения",
    labelSingle: "заключение",
    labelSingleShort: "зкл.",
    relationType: "entailment",
    direction: "outgoing",
    navHref: "/admin/relations/conclusions",
    featureKey: "conclusions_edit",
    color: "indigo",
    description: "глагольные заключения",
  },
  "pos-synonyms": {
    label: "Кросс-частеречные синонимы",
    labelSingle: "кросс-частеречный синоним",
    labelSingleShort: "чр.син.",
    relationType: "pos_synonym",
    navHref: "/admin/relations/pos-synonyms",
    featureKey: "pos_synonyms_edit",
    color: "cyan",
    description: "привязать слова другой части речи с тем же корневым значением",
  },
  "instance-of": {
    label: "Экземпляр класса (instance-of)",
    labelSingle: "класс",
    labelSingleShort: "cls.",
    relationType: "instance_of",
    direction: "outgoing",
    navHref: "/admin/relations/instance-of",
    featureKey: "instance_of_edit",
    color: "pink",
    description: "указать, экземпляром какого класса является это значение",
  },
  instances: {
    label: "Экземпляры этого класса",
    labelSingle: "экземпляр",
    labelSingleShort: "экз.",
    relationType: "instance_of",
    direction: "incoming",
    navHref: "/admin/relations/instances",
    featureKey: "instances_edit",
    color: "fuchsia",
    description: "привязать значения, являющиеся экземплярами этого класса",
  },
  "derivation-targets": {
    label: "Дериваты (образовано от этого)",
    labelSingle: "дериват",
    labelSingleShort: "дрв.",
    relationType: "derivation",
    direction: "outgoing",
    navHref: "/admin/relations/derivation-targets",
    featureKey: "derivation_targets_edit",
    color: "lime",
    description: "привязать словообразовательные производные от этого значения",
  },
  "derivation-sources": {
    label: "Источники деривации",
    labelSingle: "источник деривации",
    labelSingleShort: "ист.",
    relationType: "derivation",
    direction: "incoming",
    navHref: "/admin/relations/derivation-sources",
    featureKey: "derivation_sources_edit",
    color: "emerald",
    description: "привязать значения, от которых словообразовательно произведено это",
  },
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-500/5", text: "text-blue-600", border: "border-blue-500/20" },
  purple: { bg: "bg-purple-500/5", text: "text-purple-600", border: "border-purple-500/20" },
  green: { bg: "bg-green-500/5", text: "text-green-600", border: "border-green-500/20" },
  orange: { bg: "bg-orange-500/5", text: "text-orange-600", border: "border-orange-500/20" },
  slate: { bg: "bg-slate-500/5", text: "text-slate-600", border: "border-slate-500/20" },
  amber: { bg: "bg-amber-500/5", text: "text-amber-600", border: "border-amber-500/20" },
  rose: { bg: "bg-rose-500/5", text: "text-rose-600", border: "border-rose-500/20" },
  teal: { bg: "bg-teal-500/5", text: "text-teal-600", border: "border-teal-500/20" },
  indigo: { bg: "bg-indigo-500/5", text: "text-indigo-600", border: "border-indigo-500/20" },
  cyan: { bg: "bg-cyan-500/5", text: "text-cyan-600", border: "border-cyan-500/20" },
  pink: { bg: "bg-pink-500/5", text: "text-pink-600", border: "border-pink-500/20" },
  fuchsia: { bg: "bg-fuchsia-500/5", text: "text-fuchsia-600", border: "border-fuchsia-500/20" },
  lime: { bg: "bg-lime-500/5", text: "text-lime-600", border: "border-lime-500/20" },
  emerald: { bg: "bg-emerald-500/5", text: "text-emerald-600", border: "border-emerald-500/20" },
}

export function getRelationColors(colorName: string) {
  return COLOR_MAP[colorName] || COLOR_MAP.blue
}

export function isValidRelationType(type: string): type is RelationType {
  return type in RELATION_CONFIG
}