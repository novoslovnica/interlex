"use client"

export interface TokenResult {
    surfaceForm: string
    isPunctuation: boolean
    isRecognized: boolean
    isPartialMatch: boolean
    lemma: string
    pos: string
    wordSlug: string | null
    feats: Record<string, string>
    matchCount: number
}

export interface SentenceResult {
    position: number
    segmentIndex: number
    rawText: string
    tokens: TokenResult[]
}

export interface SegmentResult {
    position: number
    rawText: string
    sentences: SentenceResult[]
}

export interface Stats {
    totalTokens: number
    recognizedWords: number
    unrecognizedWords: number
    punctuationCount: number
}

const FEAT_LABELS: Record<string, string> = {
    nom: "nom", gen: "gen", dat: "dat", acc: "acc", ins: "ins", loc: "loc", voc: "voc",
    sg: "sg", du: "du", pl: "pl",
    masc: "m", fem: "f", neut: "n",
    anim: "anim", inanim: "inanim",
    pres: "pres", past: "past", fut: "fut", aor: "aor", impf: "impf",
    ind: "ind", imp: "imp", sub: "sub",
    act: "act", pass: "pass",
    inf: "inf", fin: "fin", part: "part", ger: "ger",
    pos: "pos", comp: "comp", sup: "sup",
}

function formatFeats(feats: Record<string, string>): string {
    const parts: string[] = []
    const order = ["case", "number", "gender", "person", "tense", "mood", "voice", "verbForm", "degree", "animacy"]
    for (const key of order) {
        const val = feats[key]
        if (val) {
            parts.push(FEAT_LABELS[val] ?? val)
        }
    }
    return parts.join(" ")
}

export function TokenBlock({ token }: { token: TokenResult }) {
    let bgColor = ""
    if (token.isPunctuation) {
        bgColor = "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
    } else if (token.isRecognized) {
        bgColor = "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300"
    } else if (token.isPartialMatch) {
        bgColor = "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300"
    } else {
        bgColor = "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
    }

    const featsStr = token.isRecognized ? formatFeats(token.feats) : ""
    const hasHomonymy = token.matchCount > 1

    return (
        <span className="inline-flex flex-col items-stretch mx-0.5 my-0.5">
            <span className="text-[10px] leading-tight text-center px-1 text-muted-foreground relative min-h-[14px]">
                {featsStr || (
                    <span className="text-[10px] text-muted-foreground/40">&mdash;</span>
                )}
                {hasHomonymy && (
                    <span className="absolute -top-0.5 -right-1 text-[9px] font-bold text-amber-500 dark:text-amber-400">
                        +{token.matchCount - 1}
                    </span>
                )}
            </span>
            <span
                className={`inline-block px-2 py-0.5 rounded-md text-sm font-mono leading-tight whitespace-nowrap ${bgColor}`}
                title={
                    token.isRecognized
                        ? `${token.lemma} (${token.pos}) [${token.wordSlug}]`
                        : token.isPartialMatch
                            ? `основа найдена: ${token.wordSlug}, но флексия не найдена`
                            : token.isPunctuation
                                ? "пунктуация"
                                : `не найдено в словаре: ${token.lemma}`
                }
            >
                {token.surfaceForm}
            </span>
        </span>
    )
}

export function SegmentView({ segments, emptyLabel }: { segments: SegmentResult[]; emptyLabel?: string }) {
    if (segments.length === 0) {
        return <p className="text-muted-foreground italic">{emptyLabel ?? "Нет данных"}</p>
    }

    return (
        <>
            {segments.map((seg) => (
                <div key={seg.position} className="mb-6">
                    {seg.position > 0 && <hr className="mb-4 border-t border-border/50" />}
                    {seg.sentences.map((s) => (
                        <div key={s.position} className="mb-3 flex flex-wrap items-baseline">
                            {s.tokens.map((t, i) => (
                                <TokenBlock key={i} token={t} />
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </>
    )
}

export function StatsBar({ stats, analyzing }: { stats: Stats | null; analyzing: boolean }) {
    if (analyzing) {
        return (
            <span className="text-xs text-muted-foreground animate-pulse">
                Анализ...
            </span>
        )
    }
    if (!stats) return null

    return (
        <span className="text-xs text-muted-foreground">
            {stats.totalTokens} токенов ·
            <span className="text-green-600 dark:text-green-400 ml-1">{stats.recognizedWords}</span>
            <span className="text-yellow-500 ml-1">{stats.totalTokens - stats.recognizedWords - stats.unrecognizedWords - stats.punctuationCount}</span>
            <span className="text-red-500 ml-1">{stats.unrecognizedWords}</span>
            <span className="text-gray-400 ml-1">/{stats.punctuationCount}</span>
        </span>
    )
}

export function ColorLegend() {
    return (
        <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-green-100 dark:bg-green-900/40 border border-green-500" />
                распознано
            </span>
            <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-500" />
                основа найдена
            </span>
            <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-red-100 dark:bg-red-900/40 border border-red-500" />
                не найдено
            </span>
            <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700 border border-gray-400" />
                пунктуация
            </span>
            <span className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-amber-500">+1</span>
                омонимия
            </span>
        </div>
    )
}