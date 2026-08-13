import RhymeClient from "./rhyme-client"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rhyme")
  return {
    title: t("heading"),
    description: t("subtitle"),
  }
}

export default function RhymePage() {
  return <RhymeClient />
}
