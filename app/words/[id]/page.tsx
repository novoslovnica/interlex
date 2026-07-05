import {getItem} from "@/app/words/[id]/api";
import {Suspense} from "react";
import Word from "@/app/words/[id]/Word";
import './word-page.css';
import {getUserScript} from "@/lib/get-user-script";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id) as { value?: string } | null;
  return {
    title: item?.value ?? `Слово #${id}`,
    description: `Словарная статья «${item?.value ?? id}» в межславянском лексиконе — значения, грамматика, этимология, переводы и однокоренные слова.`,
  };
}

const WordPage = async ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const item = await getItem(id);
    const currentScript = await getUserScript();

    return (
        <main className="main-content">
            <div className="scroll-container w-full pt-6 px-4">
                <Suspense fallback={<div>Loading...</div>}>
                    <Word item={item} currentScript={currentScript} />
                </Suspense>
            </div>
        </main>
    );
};

export default WordPage;