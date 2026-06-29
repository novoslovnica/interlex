import {getItem} from "@/app/words/[id]/api";
import {Suspense} from "react";
import Word from "@/app/words/[id]/Word";
import './word-page.css';
import {getUserScript} from "@/lib/get-user-script";

const WordPage = async ({ params }) => {
    const { id } = await params;
    const item = await getItem(id);
    const currentScript = await getUserScript()

    return (
        <main className="main-content">
            <div className="scroll-container w-full pt-6 px-4">
                <Suspense fallback={<div>Loading...</div>}>
                    <Word
                        item={item}
                        currentScript={currentScript}
                    />
                </Suspense>
            </div>
        </main>
    );
};


export default WordPage;
