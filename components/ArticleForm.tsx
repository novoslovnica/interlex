"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { parseComprehensionString, SLAVIC_LANGUAGES_MAP } from "@/lib/types/lexicon"
import { UsageType, ALL_USAGE_TYPES } from "@/lib/enums/UsageType"
import { MainCategory, ALL_MAIN_CATEGORIES } from "@/lib/enums/MainCategory"
import { generateStemCandidates } from "@/lib/grammar/common/stem-candidates"
import { generateAllFlavors } from "@/lib/flavors"

const LANGUAGES: { key: string; label: string }[] = [
  { key: "en", label: "English" },
  { key: "ru", label: "Русский" },
  { key: "mk", label: "Македонски" },
  { key: "sr", label: "Српски" },
  { key: "bg", label: "Български" },
  { key: "pl", label: "Polski" },
  { key: "cs", label: "Čeština" },
  { key: "sl", label: "Slovenščina" },
  { key: "de", label: "Deutsch" },
  { key: "uk", label: "Українська" },
  { key: "be", label: "Беларуская" },
  { key: "sk", label: "Slovenčina" },
  { key: "hr", label: "Hrvatski" },
  { key: "hsb", label: "Hornjoserbsce" },
  { key: "dsb", label: "Dolnoserbski" },
  { key: "cu", label: "Словѣньскъ" },
  { key: "nl", label: "Nederlands" },
  { key: "eo", label: "Esperanto" },
]

const POS_OPTIONS = [
  { value: "noun", label: "Noun / Существительное" },
  { value: "verb", label: "Verb / Глагол" },
  { value: "adjective", label: "Adjective / Прилагательное" },
  { value: "adverb", label: "Adverb / Наречие" },
  { value: "pronoun", label: "Pronoun / Местоимение" },
  { value: "numeral", label: "Numeral / Числительное" },
  { value: "preposition", label: "Preposition / Предлог" },
  { value: "conjunction", label: "Conjunction / Союз" },
  { value: "particle", label: "Particle / Частица" },
  { value: "interjection", label: "Interjection / Междометие" },
]

const GENDER_OPTIONS = [
  { value: "masculine", label: "Masculine / Мужской" },
  { value: "feminine", label: "Feminine / Женский" },
  { value: "neuter", label: "Neuter / Средний" },
]

const ASPECT_OPTIONS = [
  { value: "perfective", label: "Perfective / Совершенный" },
  { value: "imperfective", label: "Imperfective / Несовершенный" },
  { value: "biaspectual", label: "Biaspectual / Двувидовой" },
]

const TRANSITIVITY_OPTIONS = [
  { value: "transitive", label: "Transitive / Переходный" },
  { value: "intransitive", label: "Intransitive / Непереходный" },
]

const ANIMACY_OPTIONS = [
  { value: "animate", label: "Animate / Одушевлённое" },
  { value: "inanimate", label: "Inanimate / Неодушевлённое" },
]

const DEGREE_OPTIONS = [
  { value: "positive", label: "Positive / Положительная" },
  { value: "comparative", label: "Comparative / Сравнительная" },
  { value: "superlative", label: "Superlative / Превосходная" },
]

const PRON_TYPE_OPTIONS = [
  { value: "personal", label: "Personal / Личное" },
  { value: "possessive", label: "Possessive / Притяжательное" },
  { value: "demonstrative", label: "Demonstrative / Указательное" },
  { value: "interrogative", label: "Interrogative / Вопросительное" },
  { value: "relative", label: "Relative / Относительное" },
  { value: "indefinite", label: "Indefinite / Неопределённое" },
  { value: "negative", label: "Negative / Отрицательное" },
  { value: "reflexive", label: "Reflexive / Возвратное" },
  { value: "reciprocal", label: "Reciprocal / Взаимное" },
]

const NUM_TYPE_OPTIONS = [
  { value: "cardinal", label: "Cardinal / Количественное" },
  { value: "ordinal", label: "Ordinal / Порядковое" },
  { value: "collective", label: "Collective / Собирательное" },
  { value: "fractional", label: "Fractional / Дробное" },
]

const GOVERNS_CASE_OPTIONS = [
  { value: 2, label: "GEN (Родительный)" },
  { value: 3, label: "DAT (Дательный)" },
  { value: 4, label: "ACC (Винительный)" },
  { value: 5, label: "INS (Творительный)" },
  { value: 6, label: "LOC (Предложный)" },
]

const SLAVIC_LANG_CODES: { code: string; flag: string; name: string }[] = [
  { code: "ru", flag: "🇷🇺", name: "Русский" },
  { code: "be", flag: "🇧🇾", name: "Белорусский" },
  { code: "uk", flag: "🇺🇦", name: "Украинский" },
  { code: "pl", flag: "🇵🇱", name: "Польский" },
  { code: "cs", flag: "🇨🇿", name: "Чешский" },
  { code: "sk", flag: "🇸🇰", name: "Словацкий" },
  { code: "bg", flag: "🇧🇬", name: "Болгарский" },
  { code: "mk", flag: "🇲🇰", name: "Македонский" },
  { code: "sr", flag: "🇷🇸", name: "Сербский" },
  { code: "hr", flag: "🇭🇷", name: "Хорватский" },
  { code: "sl", flag: "🇸🇮", name: "Словенский" },
]

const GENESIS_GROUPS: { group: string; label: string; codes: { code: string; label: string }[] }[] = [
  { group: "eastSlavic", label: "Восточнославянские", codes: [{ code: "ru", label: "ru" }, { code: "v", label: "v" }] },
  { group: "southSlavic", label: "Южнославянские", codes: [{ code: "bg", label: "bg" }, { code: "mk", label: "mk" }, { code: "sr", label: "sr" }, { code: "hr", label: "hr" }, { code: "sl", label: "sl" }, { code: "sh", label: "sh" }, { code: "j", label: "j" }] },
  { group: "westSlavic", label: "Западнославянские", codes: [{ code: "pl", label: "pl" }, { code: "cs", label: "cs" }, { code: "cz", label: "cz" }, { code: "sk", label: "sk" }, { code: "z", label: "z" }] },
  { group: "romance", label: "Романские", codes: [{ code: "I", label: "I" }, { code: "F", label: "F" }, { code: "S", label: "S" }] },
  { group: "germanic", label: "Германские", codes: [{ code: "E", label: "E" }, { code: "D", label: "D" }] },
]

const PROPER_NOUN_OPTIONS = [
  { value: "yes", label: "Да" },
  { value: "no", label: "Нет" },
]

const FLAVOR_OPTIONS = [
  { value: "CORE", label: "CORE" },
  { value: "NSL", label: "NSL" },
  { value: "EAST", label: "EAST" },
  { value: "WEST", label: "WEST" },
  { value: "SOUTH", label: "SOUTH" },
]

const USAGE_TYPE_OPTIONS = [
  { value: UsageType.GENERAL, label: "Общеупотребительное" },
  { value: UsageType.COLLOQUIAL, label: "Разговорное" },
  { value: UsageType.TECHNICAL, label: "Техническое / Научное" },
  { value: UsageType.PROFESSIONAL, label: "Профессионализм" },
  { value: UsageType.OFFICIAL, label: "Официально-деловое" },
  { value: UsageType.SLANG, label: "Сленг" },
  { value: UsageType.JARGON, label: "Жаргон" },
  { value: UsageType.VULGAR, label: "Обсценное" },
  { value: UsageType.ARCHAIC, label: "Архаизм" },
  { value: UsageType.HISTORIC, label: "Историзм" },
  { value: UsageType.NEOLOGISM, label: "Неологизм" },
]

const MAIN_CATEGORY_OPTIONS = [
  { value: MainCategory.EVERYDAY_LIFE, label: "Быт" },
  { value: MainCategory.NATURE, label: "Природа" },
  { value: MainCategory.GEOGRAPHY, label: "География" },
  { value: MainCategory.HISTORY, label: "История" },
  { value: MainCategory.RELIGION, label: "Религия" },
  { value: MainCategory.SCIENCE, label: "Наука" },
  { value: MainCategory.CULTURE_ART, label: "Культура / Искусство" },
  { value: MainCategory.MEDICINE, label: "Медицина" },
  { value: MainCategory.LAW_ECONOMY, label: "Право / Экономика" },
  { value: MainCategory.ABSTRACT, label: "Абстрактное" },
]

interface TranslationData {
  id: number
  value: string
  veryfied: number
  message: string
}

interface MeaningData {
  id: number
  meaning: string
  examples: string
  meaningVeryfied: number
  meaningMessage: string
  examplesVeryfied: number
  examplesMessage: string
  translations: Record<string, TranslationData[]>
}

interface InflectionAnomalyItem {
  inflection: string
  grammeme: string
}

interface SelectedRootItem {
  id: number
  value: string
}

interface RootOption {
  id: number
  value: string | null
  roots_words?: { word?: { id: number; value: string } | null }[]
}

interface ArticleFormProps {
  title: string
  submitButtonText: string
  initialData?: {
    wordId?: number
    word: string
    stem: string
    hasAnomalies: boolean
    inflectionAnomalies: InflectionAnomalyItem[]
    attachedRoots: SelectedRootItem[]
    meanings: MeaningData[]
    allophones?: Record<string, string>
    homonymBases?: Array<{ base: string; flavor: string }>
    pos?: string | null
    gender?: string | null
    aspect?: string | null
    transitivity?: string | null
    animacy?: string | null
    degree?: string | null
    pronType?: string | null
    numType?: string | null
    governsCase?: number | null
    declension?: number | null
    conjugation?: number | null
    mainCategory?: string | null
    usageType?: string | null
    frequency?: string | null
    intelligibility?: string | null
    addition?: string | null
    sameInLanguages?: string | null
    etymology?: string | null
    proto?: string | null
    paradigm?: string | null
    protoStemClass?: string | null
    stemExtension?: string | null
    stressPosition?: number | null
    genesis?: string | null
    secondaryStem?: string | null
    tertiaryStem?: string | null
    properNoun?: boolean
    external_id?: number | null
  }
  initialRoots: RootOption[]
  onSubmit: (data: any) => Promise<void>
}

function emptyTranslations(): Record<string, TranslationData[]> {
  const result: Record<string, TranslationData[]> = {}
  for (const lang of LANGUAGES) {
    result[lang.key] = []
  }
  return result
}

type GrammarValue = string | number | null | undefined

export default function ArticleForm({
  title,
  submitButtonText,
  initialData,
  initialRoots,
  onSubmit,
}: ArticleFormProps) {
  const [isPending, startTransition] = useTransition()

  const [word, setWord] = useState(initialData?.word || "")
  const [stem, setStem] = useState(initialData?.stem || "")
  const [allophones, setAllophones] = useState<Record<string, string>>(
    initialData?.allophones || { core: "", nsl: "", east: "", west: "", south: "" }
  )
  const [homonymBases, setHomonymBases] = useState<Array<{ base: string; flavor: string }>>(
    initialData?.homonymBases || []
  )
  const [changedHomonyms, setChangedHomonyms] = useState<Set<string>>(new Set())
  const [hasAnomalies, setHasAnomalies] = useState(initialData?.hasAnomalies || false)
  const [properNoun, setProperNoun] = useState(initialData?.properNoun || false)
  const [inflectionAnomalies, setInflectionAnomalies] = useState<InflectionAnomalyItem[]>(
    initialData?.inflectionAnomalies || []
  )

  const [grammar, setGrammar] = useState<Record<string, GrammarValue>>({
    pos: initialData?.pos ?? "",
    gender: initialData?.gender ?? "",
    aspect: initialData?.aspect ?? "",
    transitivity: initialData?.transitivity ?? "",
    animacy: initialData?.animacy ?? "",
    degree: initialData?.degree ?? "",
    pronType: initialData?.pronType ?? "",
    numType: initialData?.numType ?? "",
    governsCase: initialData?.governsCase ?? null,
    declension: initialData?.declension ?? null,
    conjugation: initialData?.conjugation ?? null,
    mainCategory: initialData?.mainCategory ?? "",
    usageType: initialData?.usageType ?? "",
    addition: initialData?.addition ?? "",
    sameInLanguages: initialData?.sameInLanguages ?? "",
    proto: initialData?.proto ?? "",
    paradigm: initialData?.paradigm ?? "",
    protoStemClass: initialData?.protoStemClass ?? "",
    stemExtension: initialData?.stemExtension ?? "",
    stressPosition: initialData?.stressPosition ?? null,
    secondaryStem: initialData?.secondaryStem ?? "",
    tertiaryStem: initialData?.tertiaryStem ?? "",
    external_id: initialData?.external_id ?? null,
  })

  const [etymology, setEtymology] = useState(initialData?.etymology || "")

  const [intelligibilityState, setIntelligibilityState] = useState<Record<string, "positive" | "negative" | null>>(() => {
    const state: Record<string, "positive" | "negative" | null> = {}
    const parsed = parseComprehensionString(initialData?.intelligibility || "")
    for (const item of parsed) {
      state[item.code] = item.isUnderstood ? "positive" : "negative"
    }
    return state
  })

  const [genesisCodes, setGenesisCodes] = useState<string[]>(() => {
    if (!initialData?.genesis) return []
    return initialData.genesis.trim().split(/\s+/).filter(Boolean)
  })

  function toggleIntelligibility(code: string) {
    setIntelligibilityState((prev) => {
      const current = prev[code]
      if (current === null) return { ...prev, [code]: "positive" }
      if (current === "positive") return { ...prev, [code]: "negative" }
      return { ...prev, [code]: null }
    })
  }

  function toggleGenesisCode(code: string) {
    setGenesisCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  function setGram(key: string, value: GrammarValue) {
    setGrammar((prev) => ({ ...prev, [key]: value }))
  }

  function getPosGrammarFields(pos: string): string[] {
    const common = ["pos"]
    switch (pos) {
      case "noun":
        return [...common, "gender", "declension", "animacy"]
      case "verb":
        return [...common, "aspect", "transitivity", "conjugation"]
      case "adjective":
        return [...common, "degree", "gender"]
      case "adverb":
        return [...common, "degree"]
      case "pronoun":
        return [...common, "pronType"]
      case "numeral":
        return [...common, "numType"]
      case "preposition":
        return [...common, "governsCase"]
      default:
        return common
    }
  }

  const [meanings, setMeanings] = useState<MeaningData[]>(
    initialData?.meanings?.length
      ? initialData.meanings as MeaningData[]
      : [{ id: 0, meaning: "", examples: "", meaningVeryfied: 0, meaningMessage: "", examplesVeryfied: 0, examplesMessage: "", translations: emptyTranslations() }]
  )
  const [selectedMeaningIdx, setSelectedMeaningIdx] = useState(0)
  const [activeLang, setActiveLang] = useState("en")

  const [searchQuery, setSearchQuery] = useState("")
  const [roots, setRoots] = useState<any[]>(initialRoots)
  const [isLoadingRoots, setIsLoadingRoots] = useState(false)
  const [selectedRoots, setSelectedRoots] = useState<SelectedRootItem[]>(
    initialData?.attachedRoots || []
  )
  const [newRoots, setNewRoots] = useState<string[]>([])

  const [rejectDialog, setRejectDialog] = useState<{
    meaningIdx: number
    lang: string
    tIdx: number
    currentMessage: string
  } | null>(null)
  const [rejectText, setRejectText] = useState("")

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setRoots(initialRoots)
        return
      }
      setIsLoadingRoots(true)
      try {
        const response = await fetch(`/api/roots?query=${encodeURIComponent(searchQuery)}`)
        if (response.ok) {
          const data = await response.json()
          setRoots(data)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoadingRoots(false)
      }
    }, 350)
    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, initialRoots])

  const handleStemBlur = () => {
    const s = stem.trim()
    if (!s) {
      setHomonymBases([])
      return
    }
    const candidates = generateStemCandidates({
      stem: s,
      secondaryStem: (grammar.secondaryStem as string) || null,
      tertiaryStem: (grammar.tertiaryStem as string) || null,
      pos: (grammar.pos as string) || undefined,
      isv: word.trim() || undefined,
    })
    const oldBases = new Set(initialData?.homonymBases?.map((h) => h.base) || [])
    const newChanged = new Set<string>()
    const entries = candidates.map((c) => {
      if (!oldBases.has(c)) newChanged.add(c)
      return { base: c, flavor: "CORE" }
    })
    setChangedHomonyms(newChanged)
    setHomonymBases(entries)
  }

  // Auto-fill east/west/south allophones when core changes
  useEffect(() => {
    const core = allophones.core?.trim()
    if (!core) return
    const flavors = generateAllFlavors(core)
    setAllophones((prev) => {
      if (prev.east === flavors.east && prev.west === flavors.west && prev.south === flavors.south) return prev
      return { ...prev, east: flavors.east, west: flavors.west, south: flavors.south }
    })
  }, [allophones.core])

  const handleAllophoneBlur = (key: string) => {
    const value = allophones[key]?.trim()
    const FLAVOR_MAP: Record<string, string> = {
      core: "CORE",
      nsl: "NSL",
      east: "EAST",
      west: "WEST",
      south: "SOUTH",
    }
    const flavor = FLAVOR_MAP[key] || "CORE"

    setHomonymBases((prev) => {
      const next = prev.filter((h) => h.flavor !== flavor)
      if (value) {
        next.push({ base: value, flavor })
      }
      return next
    })
  }

  const addHomonymBase = () => {
    setHomonymBases((prev) => [...prev, { base: "", flavor: "CORE" }])
    setChangedHomonyms((prev) => new Set(prev).add(""))
  }

  const removeHomonymBase = (idx: number) => {
    setHomonymBases((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateHomonymBase = (idx: number, value: string) => {
    setHomonymBases((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], base: value }
      return next
    })
    setChangedHomonyms((prev) => new Set(prev).add(value))
  }

  const updateHomonymFlavor = (idx: number, flavor: string) => {
    setHomonymBases((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], flavor }
      return next
    })
  }

  const handleToggleRoot = useCallback((root: RootOption) => {
    setSelectedRoots((prev) => {
      const exists = prev.some((r) => r.id === root.id)
      if (exists) return prev.filter((r) => r.id !== root.id)
      return [...prev, { id: root.id, value: root.value || `ID: ${root.id}` }]
    })
  }, [])

  const handleAddNewRoot = useCallback(() => {
    const value = searchQuery.trim()
    if (!value) return
    setNewRoots((prev) => (prev.includes(value) ? prev : [...prev, value]))
    setSearchQuery("")
  }, [searchQuery])

  const activeMeaning = meanings[selectedMeaningIdx]

  const hasMultipleTranslations = useCallback((meaning: MeaningData) => {
    return Object.values(meaning.translations).some((tl) => tl.length > 1)
  }, [])

  const langHasMultiple = useCallback(
    (meaning: MeaningData, lang: string) => {
      return (meaning.translations[lang] || []).length > 1
    },
    []
  )

  function updateMeaningField(idx: number, field: keyof MeaningData, value: string) {
    setMeanings((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)))
  }

  function addMeaning() {
    setMeanings((prev) => [
      ...prev,
      { id: 0, meaning: "", examples: "", meaningVeryfied: 0, meaningMessage: "", examplesVeryfied: 0, examplesMessage: "", translations: emptyTranslations() },
    ])
  }

  function removeMeaning(idx: number) {
    setMeanings((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      if (next.length === 0) next.push({ id: 0, meaning: "", examples: "", meaningVeryfied: 0, meaningMessage: "", examplesVeryfied: 0, examplesMessage: "", translations: emptyTranslations() })
      return next
    })
    setSelectedMeaningIdx((prev) => Math.min(prev, meanings.length - 2))
  }

  function addTranslation(lang: string) {
    setMeanings((prev) =>
      prev.map((m, i) => {
        if (i !== selectedMeaningIdx) return m
        const current = m.translations[lang] || []
        return { ...m, translations: { ...m.translations, [lang]: [...current, { id: 0, value: "", veryfied: 0, message: "" }] } }
      })
    )
  }

  function updateTranslation(lang: string, tIdx: number, field: "value" | "veryfied" | "message", val: string | number) {
    setMeanings((prev) =>
      prev.map((m, i) => {
        if (i !== selectedMeaningIdx) return m
        const current = m.translations[lang] || []
        return {
          ...m,
          translations: {
            ...m.translations,
            [lang]: current.map((t, j) => (j === tIdx ? { ...t, [field]: val } : t)),
          },
        }
      })
    )
  }

  function removeTranslation(lang: string, tIdx: number) {
    setMeanings((prev) =>
      prev.map((m, i) => {
        if (i !== selectedMeaningIdx) return m
        const current = m.translations[lang] || []
        return { ...m, translations: { ...m.translations, [lang]: current.filter((_, j) => j !== tIdx) } }
      })
    )
  }

  const addAnomaly = () => setInflectionAnomalies((prev) => [...prev, { inflection: "", grammeme: "" }])
  const removeAnomaly = (idx: number) => setInflectionAnomalies((prev) => prev.filter((_, i) => i !== idx))
  const updateAnomaly = (idx: number, field: keyof InflectionAnomalyItem, value: string) =>
    setInflectionAnomalies((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const intelligibilityStr = SLAVIC_LANG_CODES
        .map(({ code }) => {
          const val = intelligibilityState[code]
          if (val === null) return ""
          return code + (val === "positive" ? "+" : "-")
        })
        .filter(Boolean)
        .join(" ")

      await onSubmit({
        wordId: initialData?.wordId,
        word,
        stem,
        allophones,
        homonymBases,
        hasAnomalies,
        properNoun,
        etymology,
        intelligibility: intelligibilityStr,
        genesis: genesisCodes.join(" "),
        inflectionAnomalies: inflectionAnomalies.filter((a) => a.inflection.trim() || a.grammeme.trim()),
        rootIds: selectedRoots.map((r) => r.id),
        newRootValues: newRoots,
        ...grammar,
        meanings: meanings.map((m) => ({
          id: m.id,
          meaning: m.meaning,
          examples: m.examples,
          meaningVeryfied: m.meaningVeryfied,
          meaningMessage: m.meaningMessage,
          examplesVeryfied: m.examplesVeryfied,
          examplesMessage: m.examplesMessage,
          translations: m.translations,
        })),
      })
    })
  }

  function SelectField({
    label,
    value,
    options,
    onChange,
  }: {
    label: string
    value: GrammarValue
    options: { value: string | number; label: string }[]
    onChange: (v: string | number) => void
  }) {
    return (
      <div>
        <label className="block text-xs font-medium mb-0.5 text-muted-foreground">{label}</label>
        <select
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value
            const opt = options.find((o) => String(o.value) === v)
            onChange(opt ? opt.value : v)
          }}
          className="w-full px-2 py-1.5 border rounded bg-background text-sm"
        >
          <option value="">—</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  function TextField({ label, value, onChange, placeholder, type = "text", hint }: {
    label: string
    value: GrammarValue
    onChange: (v: string) => void
    placeholder?: string
    type?: string
    hint?: string
  }) {
    return (
      <div>
        <label className="block text-xs font-medium mb-0.5 text-muted-foreground">{label}</label>
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(type === "number" ? e.target.value : e.target.value)}
          className="w-full px-2 py-1.5 border rounded bg-background text-sm"
          placeholder={placeholder}
        />
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    )
  }

  function NumberField({ label, value, onChange, placeholder }: {
    label: string
    value: GrammarValue
    onChange: (v: number | null) => void
    placeholder?: string
  }) {
    return (
      <div>
        <label className="block text-xs font-medium mb-0.5 text-muted-foreground">{label}</label>
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
          className="w-full px-2 py-1.5 border rounded bg-background text-sm"
          placeholder={placeholder}
        />
      </div>
    )
  }

  return (
    <div className="max-w-full mx-auto bg-background p-6 rounded-lg border shadow-sm">
      <h1 className="text-2xl font-bold mb-6">{title}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Two-column top section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Word, stem, anomalies, grammar */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Ключ для поиска</label>
              <input
                type="text"
                required
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-transparent text-sm"
                placeholder="Введите ключ для поиска..."
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                ["core", "ISV (CORE)"],
                ["nsl", "NSL"],
                ["east", "EAST"],
                ["west", "WEST"],
                ["south", "SOUTH"],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input
                    type="text"
                    value={allophones[key] || ""}
                    onChange={(e) => setAllophones((prev) => ({ ...prev, [key]: e.target.value }))}
                    onBlur={() => handleAllophoneBlur(key)}
                    className="w-full px-3 py-2 border rounded-md bg-transparent text-sm"
                    placeholder={label + "..."}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Основа</label>
<input
                  type="text"
                  value={stem}
                  onChange={(e) => setStem(e.target.value)}
                  onBlur={handleStemBlur}
                  className="w-full px-3 py-2 border rounded-md bg-transparent text-sm"
                  placeholder="Основа для поиска словоформ (н-р: vod)"
                />
            </div>

            {homonymBases.length > 0 && (
              <div className="p-3 border rounded-md bg-muted/10">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-medium text-muted-foreground">Ключи омонимов (Base_Homonym)</label>
                  <button type="button" onClick={addHomonymBase} className="text-xs px-2 py-1 border border-dashed rounded text-primary hover:bg-primary/5">+ Добавить</button>
                </div>
                <div className="space-y-2">
                  {homonymBases.map((entry, idx) => {
                    const isChanged = changedHomonyms.has(entry.base) && (!initialData?.homonymBases || !initialData.homonymBases.some((h) => h.base === entry.base))
                    return (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={entry.base}
                          onChange={(e) => updateHomonymBase(idx, e.target.value)}
                          className={`flex-1 px-2 py-1 border rounded bg-background text-xs ${
                            isChanged ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-400/50" : ""
                          }`}
                          placeholder="Основа омонима..."
                        />
                        <select
                          value={entry.flavor}
                          onChange={(e) => updateHomonymFlavor(idx, e.target.value)}
                          className="px-1 py-1 border rounded bg-background text-xs w-20"
                        >
                          {FLAVOR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => removeHomonymBase(idx)} className="text-xs text-destructive hover:text-destructive/80 px-1">✕</button>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {changedHomonyms.size > 0
                    ? "⚠ Жёлтые поля — новые ключи, будут сохранены при отправке формы."
                    : "Ключи генерируются автоматически из основы с учётом палатализации и беглых гласных."}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Этимология</label>
              <input
                type="text"
                value={etymology}
                onChange={(e) => setEtymology(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-transparent text-sm"
                placeholder="Этимологическая справка..."
              />
            </div>

            <div className="p-3 border rounded-md bg-muted/10 space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasAnomalies"
                  checked={hasAnomalies}
                  onChange={(e) => setHasAnomalies(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                <label htmlFor="hasAnomalies" className="text-xs font-medium cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors">
                  Флексии содержат аномалии
                </label>
              </div>

              {hasAnomalies && (
                <div className="pt-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-muted-foreground">Аномалии флексий</span>
                    <button type="button" onClick={addAnomaly} className="text-xs px-2 py-1 border border-dashed rounded text-primary hover:bg-primary/5">+ Добавить</button>
                  </div>
                  {inflectionAnomalies.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input type="text" value={item.inflection} onChange={(e) => updateAnomaly(idx, "inflection", e.target.value)} className="flex-1 px-2 py-1 border rounded bg-background text-xs" placeholder="Флексия (н-р: -ami)" />
                      <input type="text" value={item.grammeme} onChange={(e) => updateAnomaly(idx, "grammeme", e.target.value)} className="flex-1 px-2 py-1 border rounded bg-background text-xs" placeholder="Граммема (н-р: PL_INST)" />
                      <button type="button" onClick={() => removeAnomaly(idx)} className="text-xs text-destructive hover:text-destructive/80 px-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Intelligibility widget */}
            <div className="border rounded-md bg-muted/10 overflow-hidden">
              <div className="px-3 py-2 bg-muted/20 border-b">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Понятность</h3>
              </div>
              <div className="p-3">
                <div className="flex flex-wrap gap-1.5">
                  {SLAVIC_LANG_CODES.map(({ code, flag, name }) => {
                    const val = intelligibilityState[code]
                    let btnClass = "px-2 py-1 text-xs rounded border transition-all bg-background text-muted-foreground border-border hover:bg-muted/30"
                    if (val === "positive") btnClass = "px-2 py-1 text-xs rounded border transition-all bg-green-100 text-green-800 border-green-400 dark:bg-green-900/30 dark:text-green-300 dark:border-green-600"
                    else if (val === "negative") btnClass = "px-2 py-1 text-xs rounded border transition-all bg-red-100 text-red-800 border-red-400 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600"
                    return (
                      <button key={code} type="button" onClick={() => toggleIntelligibility(code)} className={btnClass} title={name}>
                        {flag} {code} {val === "positive" ? "+" : val === "negative" ? "−" : ""}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Нажмите для переключения: не задано → понятно (+) → непонятно (−)</p>
              </div>
            </div>

            {/* Grammar fields */}
            <div className="border rounded-md bg-muted/10 overflow-hidden">
              <div className="px-3 py-2 bg-muted/20 border-b">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Грамматические поля</h3>
              </div>
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {(function () {
                    const pos = (grammar.pos as string) || ""
                    const fields = getPosGrammarFields(pos)
                    const elements: React.ReactNode[] = []

                    if (fields.includes("pos")) {
                      elements.push(<SelectField key="pos" label="Часть речи" value={grammar.pos} options={POS_OPTIONS} onChange={(v) => setGram("pos", v)} />)
                    }
                    if (fields.includes("gender")) {
                      elements.push(<SelectField key="gender" label="Род" value={grammar.gender} options={GENDER_OPTIONS} onChange={(v) => setGram("gender", v)} />)
                    }
                    if (fields.includes("aspect")) {
                      elements.push(<SelectField key="aspect" label="Вид" value={grammar.aspect} options={ASPECT_OPTIONS} onChange={(v) => setGram("aspect", v)} />)
                    }
                    if (fields.includes("transitivity")) {
                      elements.push(<SelectField key="transitivity" label="Переходность" value={grammar.transitivity} options={TRANSITIVITY_OPTIONS} onChange={(v) => setGram("transitivity", v)} />)
                    }
                    if (fields.includes("animacy")) {
                      elements.push(<SelectField key="animacy" label="Одушевлённость" value={grammar.animacy} options={ANIMACY_OPTIONS} onChange={(v) => setGram("animacy", v)} />)
                    }
                    if (fields.includes("degree")) {
                      elements.push(<SelectField key="degree" label="Степень" value={grammar.degree} options={DEGREE_OPTIONS} onChange={(v) => setGram("degree", v)} />)
                    }
                    if (fields.includes("pronType")) {
                      elements.push(<SelectField key="pronType" label="Тип местоимения" value={grammar.pronType} options={PRON_TYPE_OPTIONS} onChange={(v) => setGram("pronType", v)} />)
                    }
                    if (fields.includes("numType")) {
                      elements.push(<SelectField key="numType" label="Тип числительного" value={grammar.numType} options={NUM_TYPE_OPTIONS} onChange={(v) => setGram("numType", v)} />)
                    }
                    if (fields.includes("governsCase")) {
                      elements.push(<SelectField key="governsCase" label="Управляемый падеж" value={grammar.governsCase} options={GOVERNS_CASE_OPTIONS} onChange={(v) => setGram("governsCase", v)} />)
                    }
                    if (fields.includes("declension")) {
                      elements.push(<NumberField key="declension" label="Склонение" value={grammar.declension} onChange={(v) => setGram("declension", v)} placeholder="1–4" />)
                    }
                    if (fields.includes("conjugation")) {
                      elements.push(<NumberField key="conjugation" label="Спряжение" value={grammar.conjugation} onChange={(v) => setGram("conjugation", v)} placeholder="1–2" />)
                    }

                    return elements
                  })()}
                  <SelectField label="Имя собственное" value={properNoun ? "yes" : "no"} options={PROPER_NOUN_OPTIONS} onChange={(v) => setProperNoun(v === "yes")} />
                  <SelectField label="Тип употребления" value={grammar.usageType} options={USAGE_TYPE_OPTIONS} onChange={(v) => setGram("usageType", v)} />
                  <SelectField label="Основная категория" value={grammar.mainCategory} options={MAIN_CATEGORY_OPTIONS} onChange={(v) => setGram("mainCategory", v)} />
                </div>

                {/* Genesis widget */}
                <div className="border-t pt-3">
                  <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Генезис</label>
                  <div className="space-y-2">
                    {GENESIS_GROUPS.map((group) => (
                      <div key={group.group}>
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{group.label}</p>
                        <div className="flex flex-wrap gap-1">
                          {group.codes.map(({ code, label }) => (
                            <button
                              key={code}
                              type="button"
                              onClick={() => toggleGenesisCode(code)}
                              className={`px-2 py-0.5 text-xs rounded border transition-all ${
                                genesisCodes.includes(code)
                                  ? "bg-primary/10 text-primary border-primary/40"
                                  : "bg-background text-muted-foreground border-border hover:bg-muted/30"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <details className="group">
                  <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                    Дополнительные поля
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <TextField label="Второстепенная основа" value={grammar.secondaryStem} onChange={(v) => setGram("secondaryStem", v)} />
                    <TextField label="Третичная основа" value={grammar.tertiaryStem} onChange={(v) => setGram("tertiaryStem", v)} />
                    <TextField label="Парадигма" value={grammar.paradigm} onChange={(v) => setGram("paradigm", v)} />
                    <TextField label="Класс прото-основы" value={grammar.protoStemClass} onChange={(v) => setGram("protoStemClass", v)} />
                    <TextField label="Расширение основы" value={grammar.stemExtension} onChange={(v) => setGram("stemExtension", v)} />
                    <NumberField label="Ударный слог (0=первый)" value={grammar.stressPosition} onChange={(v) => setGram("stressPosition", v)} placeholder="0–" />
                    <NumberField label="Внешний ID (external_id)" value={grammar.external_id} onChange={(v) => setGram("externalId", v)} placeholder="напр. 12345" />
                    <TextField label="Дополнение" value={grammar.addition} onChange={(v) => setGram("addition", v)} />
                    <TextField label="Те же в языках" value={grammar.sameInLanguages} onChange={(v) => setGram("sameInLanguages", v)} />
                    <TextField label="Праславянский" value={grammar.proto} onChange={(v) => setGram("proto", v)} />
                  </div>
                </details>
              </div>
            </div>
          </div>

          {/* Right column: Roots */}
          <div className="p-3 border rounded-md bg-muted/10">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium">Состав слова (Корни / Морфемы)</label>
              {isLoadingRoots && <span className="text-xs text-muted-foreground animate-pulse">Поиск...</span>}
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-primary mb-3"
              placeholder="Поиск корней, приставок..."
            />

            {(selectedRoots.length > 0 || newRoots.length > 0) && (
              <div className="mb-2 p-2 border border-dashed rounded-md bg-muted/10 flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                {selectedRoots.map((root) => (
                  <span key={`sel-${root.id}`} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                    {root.value}
                    <button type="button" onClick={() => setSelectedRoots((prev) => prev.filter((r) => r.id !== root.id))} className="ml-1.5 text-primary hover:text-destructive font-bold">×</button>
                  </span>
                ))}
                {newRoots.map((val, idx) => (
                  <span key={`new-${idx}`} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-green-500/10 text-green-600 border border-green-500/20">
                    [Новый]: {val}
                    <button type="button" onClick={() => setNewRoots((prev) => prev.filter((v) => v !== val))} className="ml-1.5 text-green-600 hover:text-destructive font-bold">×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="border rounded-md max-h-[400px] overflow-y-auto p-2 space-y-2 bg-muted/20 mb-2">
              {roots.length > 0 ? (
                roots.map((root) => {
                  const isSelected = selectedRoots.some((r) => r.id === root.id)
                  const attachedWords = (root.roots_words || []).map((rw: any) => rw.word).filter((w: any): w is { id: number; value: string } => !!w && !!w.value)
                  return (
                    <div key={root.id} className={`p-2 rounded-md border transition-colors ${isSelected ? "bg-primary/5 border-primary/40" : "bg-background border-border"}`}>
                      <button type="button" onClick={() => handleToggleRoot(root)} className="w-full text-left flex justify-between items-center font-medium text-sm">
                        <span>{root.value || `ID: ${root.id}`}</span>
                        <input type="checkbox" checked={isSelected} readOnly className="h-3.5 w-3.5 rounded border-muted text-primary" />
                      </button>
                      {attachedWords.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {attachedWords.map((w: any) => (
                            <span key={w.id} className="px-1.5 py-0.5 rounded text-[10px] bg-muted border text-muted-foreground">{w.value}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                !isLoadingRoots && <p className="text-xs text-muted-foreground p-2 text-center">Ничего не найдено</p>
              )}
            </div>

            <button
              type="button"
              disabled={!searchQuery.trim()}
              onClick={handleAddNewRoot}
              className="w-full text-center py-2 border border-dashed rounded-md text-sm text-primary hover:bg-primary/5 disabled:opacity-40 transition-colors font-medium"
            >
              + Добавить &quot;{searchQuery || "..."}&quot; как новый компонент
            </button>
          </div>
        </div>

        {/* Meanings section */}
        <div className="border rounded-md bg-muted/10 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
            <h2 className="text-sm font-semibold">Значения (Meanings)</h2>
            <button type="button" onClick={addMeaning} className="text-xs px-2 py-1 border border-dashed rounded text-primary hover:bg-primary/5">+ Добавить значение</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
            <div className="border-r max-h-[300px] overflow-y-auto p-2 space-y-2">
              {meanings.map((m, idx) => {
                const hasMultiple = hasMultipleTranslations(m)
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setSelectedMeaningIdx(idx); setActiveLang("en") }}
                    className={`w-full text-left p-2 rounded-md border text-xs transition-colors ${
                      idx === selectedMeaningIdx ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30" : "bg-background border-border hover:bg-muted/30"
                    } ${hasMultiple ? "border-orange-400 bg-orange-500/5" : ""}`}
                  >
                    <div className="font-medium truncate">{m.meaning || `Значение #${idx + 1}`}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{Object.values(m.translations).reduce((s, t) => s + t.length, 0)} переводов</div>
                    {hasMultiple && <div className="text-[10px] text-orange-500 font-semibold mt-0.5">⚠ множественные переводы</div>}
                  </button>
                )
              })}
            </div>

            <div className="lg:col-span-2 p-3 space-y-3">
              {activeMeaning && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-0.5">Значение (текст)</label>
                      <input type="text" value={activeMeaning.meaning} onChange={(e) => updateMeaningField(selectedMeaningIdx, "meaning", e.target.value)} className="w-full px-2 py-1.5 border rounded bg-background text-sm" placeholder="Описание значения..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-0.5">Примеры</label>
                      <input type="text" value={activeMeaning.examples} onChange={(e) => updateMeaningField(selectedMeaningIdx, "examples", e.target.value)} className="w-full px-2 py-1.5 border rounded bg-background text-sm" placeholder="Примеры использования..." />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer" title={activeMeaning.meaningVeryfied !== 1 && activeMeaning.meaningMessage ? activeMeaning.meaningMessage : undefined}>
                      <input
                        type="checkbox"
                        checked={activeMeaning.meaningVeryfied === 1}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMeanings((prev) => prev.map((m, i) => i === selectedMeaningIdx ? { ...m, meaningVeryfied: 1, meaningMessage: "" } : m))
                          } else {
                            const msg = prompt("Укажите причину отклонения значения:", activeMeaning.meaningMessage || "")
                            if (msg !== null) {
                              setMeanings((prev) => prev.map((m, i) => i === selectedMeaningIdx ? { ...m, meaningVeryfied: 0, meaningMessage: msg } : m))
                            }
                          }
                        }}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary"
                      />
                      <span>Значение верифицировано</span>
                    </label>
                    {activeMeaning.meaningVeryfied !== 1 && activeMeaning.meaningMessage && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded truncate max-w-[200px]" title={activeMeaning.meaningMessage}>
                        {activeMeaning.meaningMessage}
                      </span>
                    )}
                    <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer" title={activeMeaning.examplesVeryfied !== 1 && activeMeaning.examplesMessage ? activeMeaning.examplesMessage : undefined}>
                      <input
                        type="checkbox"
                        checked={activeMeaning.examplesVeryfied === 1}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMeanings((prev) => prev.map((m, i) => i === selectedMeaningIdx ? { ...m, examplesVeryfied: 1, examplesMessage: "" } : m))
                          } else {
                            const msg = prompt("Укажите причину отклонения примеров:", activeMeaning.examplesMessage || "")
                            if (msg !== null) {
                              setMeanings((prev) => prev.map((m, i) => i === selectedMeaningIdx ? { ...m, examplesVeryfied: 0, examplesMessage: msg } : m))
                            }
                          }
                        }}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary"
                      />
                      <span>Примеры верифицированы</span>
                    </label>
                    {activeMeaning.examplesVeryfied !== 1 && activeMeaning.examplesMessage && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded truncate max-w-[200px]" title={activeMeaning.examplesMessage}>
                        {activeMeaning.examplesMessage}
                      </span>
                    )}
                  </div>

                  {meanings.length > 1 && (
                    <button type="button" onClick={() => removeMeaning(selectedMeaningIdx)} className="text-xs text-destructive hover:text-destructive/80">Удалить это значение</button>
                  )}

                  <div>
                    <label className="block text-xs font-medium mb-1">Переводы</label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {LANGUAGES.map((lang) => {
                        const translations = activeMeaning.translations[lang.key] || []
                        const count = translations.length
                        const isMultiple = count > 1
                        const isActive = activeLang === lang.key
                        return (
                          <button key={lang.key} type="button" onClick={() => setActiveLang(lang.key)}
                            className={`px-2 py-1 text-xs rounded border transition-all ${
                              isActive ? "bg-primary text-primary-foreground border-primary" : isMultiple ? "bg-orange-500/10 text-orange-600 border-orange-300" : "bg-background text-muted-foreground border-border hover:bg-muted/30"
                            }`}
                          >
                            {lang.label}
                            {count > 0 && <span className={`ml-1 px-1 rounded text-[10px] ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted-foreground/10 text-muted-foreground"}`}>{count}</span>}
                          </button>
                        )
                      })}
                    </div>

                    <div className="border rounded-md bg-background p-2 space-y-2">
                      {(!activeMeaning.translations[activeLang] || activeMeaning.translations[activeLang].length === 0) && (
                        <p className="text-xs text-muted-foreground text-center py-2">Нет переводов на этот язык</p>
                      )}
                      {(activeMeaning.translations[activeLang] || []).map((t, tIdx) => (
                        <div key={tIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={t.value}
                            onChange={(e) => updateTranslation(activeLang, tIdx, "value", e.target.value)}
                            className="flex-1 px-2 py-1.5 border rounded bg-background text-sm"
                            placeholder="Перевод..."
                            title={!t.veryfied && t.message ? t.message : undefined}
                          />
                          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer whitespace-nowrap" title={!t.veryfied && t.message ? t.message : undefined}>
                            <input
                              type="checkbox"
                              checked={t.veryfied === 1}
                              onChange={(e) => {
                                if (!e.target.checked) {
                                  setRejectDialog({ meaningIdx: selectedMeaningIdx, lang: activeLang, tIdx, currentMessage: t.message })
                                  setRejectText(t.message)
                                } else {
                                  updateTranslation(activeLang, tIdx, "veryfied", 1)
                                  updateTranslation(activeLang, tIdx, "message", "")
                                }
                              }}
                              className="h-3 w-3 rounded border-gray-300 text-primary"
                            />
                            {!t.veryfied && t.message ? (
                              <span className="text-amber-600 truncate max-w-[100px]">{t.message}</span>
                            ) : (
                              "Verified"
                            )}
                          </label>
                          <button type="button" onClick={() => removeTranslation(activeLang, tIdx)} className="text-xs text-destructive hover:text-destructive/80 px-1" title="Удалить перевод">✕</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addTranslation(activeLang)} className="w-full text-center py-1.5 border border-dashed rounded text-xs text-primary hover:bg-primary/5 transition-colors">+ Добавить перевод</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button type="submit" disabled={isPending} className="px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">
            {isPending ? "Сохранение..." : submitButtonText}
          </button>
        </div>
      </form>

      {/* Rejection dialog for translations */}
      {rejectDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setRejectDialog(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-4 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-2">Комментарий к отклонению</h3>
            <textarea
              value={rejectText}
              onChange={(e) => setRejectText(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm resize-none h-20"
              placeholder="Укажите причину отклонения..."
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setRejectDialog(null)}
                className="px-3 py-1.5 text-xs rounded border hover:bg-gray-100"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (rejectDialog) {
                    updateTranslation(rejectDialog.lang, rejectDialog.tIdx, "veryfied", 0)
                    updateTranslation(rejectDialog.lang, rejectDialog.tIdx, "message", rejectText)
                    setRejectDialog(null)
                    setRejectText("")
                  }
                }}
                className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}