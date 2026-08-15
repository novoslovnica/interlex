import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getUserScript } from "@/lib/get-user-script";
import CollocationsBrowser from "./CollocationsBrowser";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("corpus.collocations");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function CollocationsPage() {
  const currentScript = await getUserScript();

  return (
    <main className="main-content">
      <CollocationsBrowser currentScript={currentScript} />
    </main>
  );
}
