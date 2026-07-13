import Link from "next/link"
import { APP_VERSION, CHANGELOG } from "@/config/app"
import { getTranslations } from "next-intl/server"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("changelog")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function ChangelogPage() {
  const t = await getTranslations("changelog")

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-12">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            {t("heading")}
          </h1>
          <p className="text-sm text-muted-foreground">
            Tekuča versija: <span className="font-bold text-foreground">{APP_VERSION}</span>
          </p>
        </header>

        <div className="relative space-y-0">
          <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-border" />

          {CHANGELOG.map((entry, idx) => (
            <div key={entry.version} className="relative pl-8 pb-12 last:pb-0">
              <div className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 ${
                idx === 0 ? "bg-muted-foreground border-muted-foreground" : "bg-background border-muted-foreground"
              }`} />

              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs font-mono font-bold text-muted-foreground">v{entry.version}</span>
                    <span className="text-xs text-muted-foreground">{entry.date}</span>
                  </div>
                  <h2 className="text-lg font-bold tracking-tight">{entry.title}</h2>
                  <p className="text-xs text-muted-foreground italic">{entry.titleIsv}</p>
                </div>

                <ul className="space-y-2">
                  {entry.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs md:text-sm">
                      <span className="mt-[5px] w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
                      <span>
                        <span className="text-muted-foreground">{f.isv}</span>
                        <span className="text-muted-foreground/50"> — </span>
                        <span>{f.ru}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-4 border-t">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          >
            {t("backLink")}
          </Link>
        </div>
      </div>
    </div>
  )
}