import TransliterationClient from "./transliteration-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Транслитератор",
  description:
    "Конвертация текста между системами правописания межславянского языка: этимологическая, стандартная и простая (латиница и кириллица).",
}

export default function TransliterationPage() {
  return <TransliterationClient />
}