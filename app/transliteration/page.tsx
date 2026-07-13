import TransliterationClient from "./transliteration-client"
import type { Metadata } from "next"
import {getTranslations} from "next-intl/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transliteration");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function TransliterationPage() {
  return <TransliterationClient />
}