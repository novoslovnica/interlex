import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { Metadata } from "next"
import { fetchHomonymDuplicateReport } from "@/lib/corpus/fetchHomonymDuplicates"
import { DUPLICATE_TRAP_EXAMPLES, type DuplicatePairAgg, type LexemeMeta } from "@/lib/corpus/homonymDuplicates"

export const metadata: Metadata = {
    title: "Дубли по омонимам | Админ-панель",
    description: "Пары лексем, конкурирующих за одни и те же токены корпуса — вход в дедупликацию.",
}

const TIER_LABEL: Record<DuplicatePairAgg["pair"]["kind"], string> = {
    "identical-value": "value совпадает буквально",
    "confirmed-variant": "различие только в подтверждённых парах написаний (u→ų, i→y, dž→đ)",
    "folded-only": "совпадает лишь после свёртки диакритики — гипотеза",
}

function formatPerMln(v: number | null): string {
    if (v === null) return "—"
    return v >= 100 ? String(Math.round(v)) : v.toFixed(1)
}

function LexemeCell({ label, slug, lexeme }: { label: string; slug: string; lexeme: LexemeMeta | undefined }) {
    return (
        <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
                <Link href={`/words/${slug}`} target="_blank" className="font-mono text-sm text-primary hover:underline">
                    {slug}
                </Link>
            </div>
            <div className="text-[11px] text-muted-foreground">
                value={lexeme?.value ?? "—"} · POS={lexeme?.pos ?? "—"} · основа={lexeme?.stem ?? "—"} ·
                {" "}род={lexeme?.gender ?? "—"} · част/млн={formatPerMln(lexeme?.corpusFrequencyPerMln ?? null)}
            </div>
        </div>
    )
}

function PairRow({
    agg,
    bySlug,
}: {
    agg: DuplicatePairAgg
    bySlug: Map<string, LexemeMeta>
}) {
    const p = agg.pair
    const aSlug = p.legacySlug ?? p.a
    const bSlug = p.legacySlug ? p.otherSlug : p.b
    return (
        <div className="border rounded-lg p-3 space-y-2 bg-background">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                    {p.safe ? (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-600 text-white">SAFE</span>
                    ) : (
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                            проверить
                        </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{TIER_LABEL[p.kind]}</span>
                    {p.genderMismatch && <span className="text-[11px] text-red-500">род расходится</span>}
                    {!p.stemEqRaw && <span className="text-[11px] text-muted-foreground">основы различаются буквально</span>}
                </div>
                <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{agg.maxTokens.toLocaleString("ru-RU")} токенов</div>
                    <div className="text-[11px] text-muted-foreground">
                        в {agg.groups} группах · до {agg.maxDocuments} док. · суммарно {agg.sumTokens.toLocaleString("ru-RU")}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <LexemeCell label={p.legacySlug ? "старый формат" : "лексема A"} slug={aSlug} lexeme={bySlug.get(aSlug)} />
                <LexemeCell label={p.legacySlug ? "новый формат" : "лексема B"} slug={bSlug} lexeme={bySlug.get(bSlug)} />
            </div>

            <div className="flex items-center gap-3 text-[11px] pt-1 border-t border-border">
                <span className="text-muted-foreground">
                    всплывает в формах: <span className="font-mono">{agg.forms.join(", ")}</span>
                </span>
                <span className="flex-1" />
                {agg.forms[0] && (
                    <Link href={`/admin/corpus/homonyms?q=${encodeURIComponent(agg.forms[0])}`} className="text-primary hover:underline">
                        группы этой формы →
                    </Link>
                )}
                <Link href="/admin/deduplication" className="text-primary hover:underline">
                    слить в дедупликации →
                </Link>
            </div>
        </div>
    )
}

export default async function HomonymDuplicatesPage() {
    const session = await auth()
    if (!session) redirect("/login")
    await requirePermission(session, Feature.DeduplicationManage)

    const report = await fetchHomonymDuplicateReport()
    const bySlug = new Map(report.groups.flatMap((g) => g.lexemes).map((l) => [l.slug, l]))

    const safePairs = report.pairs.filter((x) => x.pair.safe)
    const hypothesisPairs = report.pairs.filter((x) => !x.pair.safe)
    const t = report.totals

    return (
        <div className="flex-1 min-h-0 overflow-auto p-6 space-y-5">
            <div className="space-y-1">
                <h1 className="text-xl font-bold">Дубли по омонимам</h1>
                <p className="text-sm text-muted-foreground max-w-4xl">
                    Лексемы, конкурирующие за одни и те же токены корпуса (группы из{" "}
                    <Link href="/admin/corpus/homonyms" className="text-primary hover:underline">очереди омонимов</Link>),
                    но, судя по словарю, это одна и та же запись дважды. Список отсортирован по нагрузке:
                    одно слияние снимает конкуренцию сразу во всех формах пары.
                </p>
            </div>

            <div className="border rounded-xl p-4 bg-muted/20 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                        <div className="text-2xl font-bold tabular-nums">{t.flaggedGroups.toLocaleString("ru-RU")}</div>
                        <div className="text-xs text-muted-foreground">групп с признаками дублей</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold tabular-nums">{t.tokensInFlagged.toLocaleString("ru-RU")}</div>
                        <div className="text-xs text-muted-foreground">токенов в них</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold tabular-nums">{t.distinctPairs}</div>
                        <div className="text-xs text-muted-foreground">уникальных пар лексем</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {t.distinctSafePairs}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            безопасных ({t.safe.tokens.toLocaleString("ru-RU")} токенов)
                        </div>
                    </div>
                </div>
                <div className="text-xs text-muted-foreground pt-1 border-t border-border">
                    из {t.distinctPairs} пар {t.distinctLegacyPairs} — со слагом старого формата (POS строчными) ·
                    {" "}по уровням: identical-value {t.kind["identical-value"].pairs},
                    {" "}confirmed-variant {t.kind["confirmed-variant"].pairs},
                    {" "}folded-only {t.kind["folded-only"].pairs}
                </div>
            </div>

            <section className="space-y-2">
                <h2 className="text-sm font-semibold">
                    Безопасно слить <span className="text-muted-foreground font-normal">
                        ({safePairs.length} пар — value, основа, род и POS совпадают буквально)
                    </span>
                </h2>
                {safePairs.length === 0 && <p className="text-sm text-muted-foreground">Таких пар нет.</p>}
                {safePairs.map((agg) => (
                    <PairRow key={`${agg.pair.a}~${agg.pair.b}`} agg={agg} bySlug={bySlug} />
                ))}
            </section>

            <section className="space-y-2">
                <h2 className="text-sm font-semibold">
                    Гипотезы — смотреть глазами <span className="text-muted-foreground font-normal">
                        ({hypothesisPairs.length} пар)
                    </span>
                </h2>
                <p className="text-xs text-muted-foreground max-w-4xl">
                    Здесь совпадение опирается на свёртку диакритики или на подтверждённые пары написаний.
                    Подтверждённые пары (u→ų, i→y, dž→đ) — правило <b>распознавания форм</b>, а не утверждение,
                    что две цитатные формы — одно слово, поэтому в этом списке есть чужие друг другу слова.
                </p>
                {hypothesisPairs.map((agg) => (
                    <PairRow key={`${agg.pair.a}~${agg.pair.b}`} agg={agg} bySlug={bySlug} />
                ))}
            </section>

            <div className="border rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 space-y-2">
                <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Известные ловушки</h2>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {DUPLICATE_TRAP_EXAMPLES.map((e) => <li key={e}>{e}</li>)}
                </ul>
                <p className="text-xs text-muted-foreground">
                    Слияние делает модератор в{" "}
                    <Link href="/admin/deduplication" className="text-primary hover:underline">дедупликации</Link> —
                    отчёт ничего не меняет. Перед переразметкой корпуса частотность надо перенести на цель слияния
                    (<code>mergeLexemes.ts</code> для этого не годится: он сворачивает значения в одно).
                </p>
            </div>
        </div>
    )
}
