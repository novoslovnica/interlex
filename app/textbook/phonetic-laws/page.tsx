import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { BEGINNER_FLASHCARDS, BEGINNER_ROUTE, FALSE_FRIENDS } from "@/lib/beginner-route"

const examples = [
  {
    id: "liquids",
    proto: "*korva",
    forms: [["ru", "корова"], ["pl", "krowa"], ["cs", "kráva"]],
    source: "https://www.asau.ru/files/pdf/1883033.pdf",
    citation: "The Dialectology of Slavic · p. 1586",
  },
  {
    id: "nasals",
    proto: "*rǫka",
    forms: [["ru", "рука"], ["pl", "ręka"], ["cs", "ruka"]],
    source: "https://repozytorium.uwb.edu.pl/jspui/bitstream/11320/1115/1/BAJ_13_Behrendt.pdf",
    citation: "Sonia Behrendt · Polska i rosyjska rodzina wyrazów pochodzących od ps. *rǫka",
  },
  {
    id: "yers",
    proto: "*sъnъ",
    forms: [["ru", "сон"], ["pl", "sen"], ["cs", "sen"]],
    source: "https://api.pageplace.de/preview/DT0400.9783110542431_A33482937/preview-9783110542431_A33482937.pdf",
    citation: "Daniel E. Collins · The phonology of Slavic",
  },
] as const

const correspondenceLanguages = ["ru", "pl", "cs"] as const

// Illustrative cognates from the Interslavic derivation and orthography references.
const correspondences = [
  { pattern: "rå", isv: "kråva", ru: ["к", "оро", "ва"], pl: ["k", "ro", "wa"], cs: ["k", "rá", "va"] },
  { pattern: "lå", isv: "glåva", ru: ["г", "оло", "ва"], pl: ["g", "ło", "wa"], cs: ["h", "la", "va"] },
  { pattern: "ě", isv: "běly", ru: ["б", "е", "лый"], pl: ["b", "ia", "ły"], cs: ["b", "í", "lý"] },
  { pattern: "ę", isv: "pęť", ru: ["п", "я", "ть"], pl: ["p", "ię", "ć"], cs: ["p", "ě", "t"] },
  { pattern: "ų", isv: "rųka", ru: ["р", "у", "ка"], pl: ["r", "ę", "ka"], cs: ["r", "u", "ka"] },
  { pattern: "ė", isv: "otėc", ru: ["от", "е", "ц"], pl: ["ojci", "e", "c"], cs: ["ot", "e", "c"] },
  { pattern: "ȯ", isv: "sȯn", ru: ["с", "о", "н"], pl: ["s", "e", "n"], cs: ["s", "e", "n"] },
] as const

function HighlightedWord({ parts }: { parts: readonly [string, string, string] }) {
  const [prefix, sound, suffix] = parts
  return <>{prefix}<strong className="font-bold text-primary">{sound}</strong>{suffix}</>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("textbook.phoneticLaws")
  return { title: t("title"), description: t("description") }
}

export default async function PhoneticLawsPage() {
  const [t, beginner] = await Promise.all([
    getTranslations("textbook.phoneticLaws"),
    getTranslations("beginner"),
  ])
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
      <article className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-8 sm:py-12">
        <header className="space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
            <Link href="/textbook/ru" className="text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              {t("back")}
            </Link>
            <Link href={BEGINNER_ROUTE} className="text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              {beginner("title")}
            </Link>
            <Link href={FALSE_FRIENDS} className="text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              {beginner("falseFriends")}
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
          <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
        </header>

        <figure aria-labelledby="sound-laws-caption" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {examples.map(({ id, proto, forms, source, citation }) => (
              <section key={id} className="flex flex-col rounded-2xl border bg-muted/30 p-4 sm:p-5">
                <h2 className="text-lg font-semibold">{t(`${id}.title`)}</h2>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{t(`${id}.description`)}</p>
                <div className="mt-5 text-center">
                  <div className="inline-flex flex-col rounded-xl border border-primary/30 bg-primary/10 px-5 py-2">
                    <span className="text-xs text-muted-foreground">{t("proto")}</span>
                    <span className="font-mono text-xl font-bold">{proto}</span>
                  </div>
                  <svg
                    viewBox="0 0 300 36"
                    preserveAspectRatio="none"
                    className="h-9 w-full text-primary/60"
                    aria-hidden="true"
                  >
                    <path d="M150 0v30M150 14H50v16m100-16h100v16" fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" />
                    <path d="m46 29 4 6 4-6Zm100 0 4 6 4-6Zm100 0 4 6 4-6Z" fill="currentColor" />
                  </svg>
                  <ul className="grid grid-cols-3 gap-1">
                    {forms.map(([language, word]) => (
                      <li key={language} className="flex flex-col rounded-lg border bg-background px-1 py-2.5">
                        <span className="text-xs text-muted-foreground">{t(`languages.${language}`)}</span>
                        <span lang={language} className="text-base font-semibold">{word}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <a href={source} className="mt-4 text-xs text-primary underline underline-offset-4">{citation}</a>
              </section>
            ))}
          </div>
          <figcaption id="sound-laws-caption" className="text-sm text-muted-foreground">{t("legend")}</figcaption>
        </figure>

        <section id="correspondences" aria-labelledby="correspondences-title" className="scroll-mt-4 space-y-3">
          <h2 id="correspondences-title" className="text-2xl font-semibold tracking-tight">{t("table.title")}</h2>
          <p id="correspondences-note" className="max-w-3xl text-sm text-muted-foreground">{t("table.description")}</p>
          <div role="region" tabIndex={0} aria-labelledby="correspondences-title"
              className="overflow-x-auto rounded-xl border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <table aria-describedby="correspondences-note" className="w-full min-w-max text-left text-sm">
              <thead className="border-b bg-muted/60">
                <tr>
                  <th scope="col" className="px-4 py-3">{t("table.pattern")}</th>
                  <th scope="col" className="px-4 py-3">{t("table.interslavic")}</th>
                  {correspondenceLanguages.map((language) => (
                    <th key={language} scope="col" className="px-4 py-3">{t(`languages.${language}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {correspondences.map(({ pattern, isv, ...forms }) => {
                  const position = isv.indexOf(pattern)
                  const parts = [isv.slice(0, position), pattern, isv.slice(position + pattern.length)] as const
                  return (
                    <tr key={pattern}>
                      <th scope="row" className="px-4 py-2.5 font-mono font-semibold">{pattern}</th>
                      <td lang="isv" className="px-4 py-2.5"><HighlightedWord parts={parts} /></td>
                      {correspondenceLanguages.map((language) => (
                        <td key={language} lang={language} className="px-4 py-2.5"><HighlightedWord parts={forms[language]} /></td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("table.sources")}{" "}
            <a href="https://interslavic.fun/learn/vocabulary/derivation/" className="text-primary underline underline-offset-4">{t("table.derivation")}</a>
            {" · "}
            <a href="https://interslavic.fun/learn/orthography/" className="text-primary underline underline-offset-4">{t("table.orthography")}</a>
          </p>
        </section>
        <Link href={BEGINNER_FLASHCARDS}
            className="inline-block rounded-lg border px-4 py-2 font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          {beginner("cards.title")} →
        </Link>
      </article>
    </main>
  )
}
