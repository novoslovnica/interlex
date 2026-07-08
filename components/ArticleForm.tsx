"use client"

import { useState, useTransition, useEffect, useCallback } from "react"

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

interface TranslationData {
  id: number
  value: string
  veryfied: number
}

interface MeaningData {
  id: number
  meaning: string
  examples: string
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
    word: string
    stem: string
    hasAnomalies: boolean
    inflectionAnomalies: InflectionAnomalyItem[]
    attachedRoots: SelectedRootItem[]
    meanings: MeaningData[]
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
    field?: string | null
    type?: string | null
    frequency?: string | null
    intelligibility?: string | null
    addition?: string | null
    sameInLanguages?: string | null
    etymology?: string | null
    proto?: string | null
    paradigm?: string | null
    protoStemClass?: string | null
    stemExtension?: string | null
    genesis?: string | null
    secondaryStem?: string | null
    tertiaryStem?: string | null
    accentSyllable?: number | null
    alternationType?: string | null
    fleetingVowelAt?: number | null
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
  const [hasAnomalies, setHasAnomalies] = useState(initialData?.hasAnomalies || false)
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
    field: initialData?.field ?? "",
    type: initialData?.type ?? "",
    frequency: initialData?.frequency ?? "",
    intelligibility: initialData?.intelligibility ?? "",
    addition: initialData?.addition ?? "",
    sameInLanguages: initialData?.sameInLanguages ?? "",
    etymology: initialData?.etymology ?? "",
    proto: initialData?.proto ?? "",
    paradigm: initialData?.paradigm ?? "",
    protoStemClass: initialData?.protoStemClass ?? "",
    stemExtension: initialData?.stemExtension ?? "",
    genesis: initialData?.genesis ?? "",
    secondaryStem: initialData?.secondaryStem ?? "",
    tertiaryStem: initialData?.tertiaryStem ?? "",
    accentSyllable: initialData?.accentSyllable ?? null,
    alternationType: initialData?.alternationType ?? "",
    fleetingVowelAt: initialData?.fleetingVowelAt ?? null,
  })

  function setGram(key: string, value: GrammarValue) {
    setGrammar((prev) => ({ ...prev, [key]: value }))
  }

  const [meanings, setMeanings] = useState<MeaningData[]>(
    initialData?.meanings?.length
      ? initialData.meanings
      : [{ id: 0, meaning: "", examples: "", translations: emptyTranslations() }]
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
      { id: 0, meaning: "", examples: "", translations: emptyTranslations() },
    ])
  }

  function removeMeaning(idx: number) {
    setMeanings((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      if (next.length === 0) next.push({ id: 0, meaning: "", examples: "", translations: emptyTranslations() })
      return next
    })
    setSelectedMeaningIdx((prev) => Math.min(prev, meanings.length - 2))
  }

  function addTranslation(lang: string) {
    setMeanings((prev) =>
      prev.map((m, i) => {
        if (i !== selectedMeaningIdx) return m
        const current = m.translations[lang] || []
        return { ...m, translations: { ...m.translations, [lang]: [...current, { id: 0, value: "", veryfied: 0 }] } }
      })
    )
  }

  function updateTranslation(lang: string, tIdx: number, field: "value" | "veryfied", val: string | number) {
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
      await onSubmit({
        word,
        stem,
        hasAnomalies,
        inflectionAnomalies: inflectionAnomalies.filter((a) => a.inflection.trim() || a.grammeme.trim()),
        rootIds: selectedRoots.map((r) => r.id),
        newRootValues: newRoots,
        ...grammar,
        meanings: meanings.map((m) => ({
          id: m.id,
          meaning: m.meaning,
          examples: m.examples,
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
              <label className="block text-sm font-medium mb-1">Слово</label>
              <input
                type="text"
                required
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-transparent text-sm"
                placeholder="Введите слово..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Основа</label>
              <input
                type="text"
                value={stem}
                onChange={(e) => setStem(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-transparent text-sm"
                placeholder="Основа для поиска словоформ (н-р: vod)"
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

            {/* Grammar fields */}
            <div className="border rounded-md bg-muted/10 overflow-hidden">
              <div className="px-3 py-2 bg-muted/20 border-b">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Грамматические поля</h3>
              </div>
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Часть речи" value={grammar.pos} options={POS_OPTIONS} onChange={(v) => setGram("pos", v)} />
                  <SelectField label="Род" value={grammar.gender} options={GENDER_OPTIONS} onChange={(v) => setGram("gender", v)} />
                  <SelectField label="Вид" value={grammar.aspect} options={ASPECT_OPTIONS} onChange={(v) => setGram("aspect", v)} />
                  <SelectField label="Переходность" value={grammar.transitivity} options={TRANSITIVITY_OPTIONS} onChange={(v) => setGram("transitivity", v)} />
                  <SelectField label="Одушевлённость" value={grammar.animacy} options={ANIMACY_OPTIONS} onChange={(v) => setGram("animacy", v)} />
                  <SelectField label="Степень" value={grammar.degree} options={DEGREE_OPTIONS} onChange={(v) => setGram("degree", v)} />
                  <SelectField label="Тип местоимения" value={grammar.pronType} options={PRON_TYPE_OPTIONS} onChange={(v) => setGram("pronType", v)} />
                  <SelectField label="Тип числительного" value={grammar.numType} options={NUM_TYPE_OPTIONS} onChange={(v) => setGram("numType", v)} />
                  <SelectField label="Управляемый падеж" value={grammar.governsCase} options={GOVERNS_CASE_OPTIONS} onChange={(v) => setGram("governsCase", v)} />
                  <NumberField label="Склонение" value={grammar.declension} onChange={(v) => setGram("declension", v)} placeholder="1–4" />
                  <NumberField label="Спряжение" value={grammar.conjugation} onChange={(v) => setGram("conjugation", v)} placeholder="1–2" />
                  <NumberField label="Ударный слог" value={grammar.accentSyllable} onChange={(v) => setGram("accentSyllable", v)} placeholder="0-based" />
                  <NumberField label="Беглая гласная на" value={grammar.fleetingVowelAt} onChange={(v) => setGram("fleetingVowelAt", v)} placeholder="позиция" />
                  <TextField label="Поле / Сфера" value={grammar.field} onChange={(v) => setGram("field", v)} placeholder="быт, техника..." />
                  <TextField label="Тип" value={grammar.type} onChange={(v) => setGram("type", v)} placeholder="полнозначное..." />
                </div>

                <details className="group">
                  <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                    Дополнительные поля
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <TextField label="Второстепенная основа" value={grammar.secondaryStem} onChange={(v) => setGram("secondaryStem", v)} />
                    <TextField label="Третичная основа" value={grammar.tertiaryStem} onChange={(v) => setGram("tertiaryStem", v)} />
                    <TextField label="Тип альтернации" value={grammar.alternationType} onChange={(v) => setGram("alternationType", v)} />
                    <TextField label="Парадигма" value={grammar.paradigm} onChange={(v) => setGram("paradigm", v)} />
                    <TextField label="Класс прото-основы" value={grammar.protoStemClass} onChange={(v) => setGram("protoStemClass", v)} />
                    <TextField label="Расширение основы" value={grammar.stemExtension} onChange={(v) => setGram("stemExtension", v)} />
                    <TextField label="Частота" value={grammar.frequency} onChange={(v) => setGram("frequency", v)} />
                    <TextField label="Понятность" value={grammar.intelligibility} onChange={(v) => setGram("intelligibility", v)} />
                    <TextField label="Дополнение" value={grammar.addition} onChange={(v) => setGram("addition", v)} />
                    <TextField label="Те же в языках" value={grammar.sameInLanguages} onChange={(v) => setGram("sameInLanguages", v)} />
                    <TextField label="Этимология" value={grammar.etymology} onChange={(v) => setGram("etymology", v)} />
                    <TextField label="Праславянский" value={grammar.proto} onChange={(v) => setGram("proto", v)} />
                    <TextField label="Генезис" value={grammar.genesis} onChange={(v) => setGram("genesis", v)} />
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
                          <input type="text" value={t.value} onChange={(e) => updateTranslation(activeLang, tIdx, "value", e.target.value)} className="flex-1 px-2 py-1.5 border rounded bg-background text-sm" placeholder="Перевод..." />
                          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer whitespace-nowrap">
                            <input type="checkbox" checked={t.veryfied === 1} onChange={(e) => updateTranslation(activeLang, tIdx, "veryfied", e.target.checked ? 1 : 0)} className="h-3 w-3 rounded border-gray-300 text-primary" />
                            Verified
                          </label>
                          <button type="button" onClick={() => removeTranslation(activeLang, tIdx)} className="text-xs text-destructive hover:text-destructive/80 px-1">✕</button>
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
    </div>
  )
}