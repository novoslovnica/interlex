import Link from "next/link"
import { getTranslations } from "next-intl/server"
import cards from "./deck.json"
import "./print.css"

// When printed on the long edge, the back of each row is reflected horizontally.
const backs = cards.flatMap((card, index) => index % 2 === 0 ? [cards[index + 1], card] : [])

export default async function PrintableFlashcardsPage() {
    const t = await getTranslations("printCards")
    return (
        <main className="print-deck min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
            <div className="mx-auto max-w-3xl px-4 py-8">
                <header className="space-y-4 pb-6">
                    <Link href="/textbook/beginner" className="underline">{t("back")}</Link>
                    <h1 className="text-3xl font-bold">{t("title")}</h1>
                    <p>{t("instructions")}</p>
                    <div>
                        <a href="/downloads/interlex-a1-isv-ru.pdf" download className="inline-block rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                            {t("download")}
                        </a>
                    </div>
                </header>
                {[cards, backs].map((side, page) => (
                    <section className="print-deck-sheet" key={page}>
                        <h2 className="text-center text-sm font-semibold">
                            {t(page === 0 ? "front" : "backSide")}
                        </h2>
                        <ol className="print-deck-grid">
                            {side.map(card => (
                                <li className="print-deck-card" key={card.id}>
                                    <span className="print-deck-number">{card.index}</span>
                                    {page === 0 ? (
                                        <>
                                            <Link href={`/words/${card.id}`} lang="isv-Latn" className="font-semibold underline-offset-4 hover:underline focus-visible:underline">{card.word}</Link>
                                            <span lang="isv-Cyrl">{card.cyrillic}</span>
                                        </>
                                    ) : <span lang="ru" className="font-semibold">{card.translation}</span>}
                                </li>
                            ))}
                        </ol>
                    </section>
                ))}
            </div>
        </main>
    )
}
