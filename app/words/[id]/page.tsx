import {getItem} from "@/app/words/[id]/api";
import {Suspense} from "react";
import Word from "@/app/words/[id]/Word";
import './word-page.css';

const WordPage = async ({ params }) => {
    const { id } = await params;
    const item = await getItem(id);
    return (
        <main className="main-content">
            <div className="scroll-container w-full pt-6 px-4">
                <Suspense fallback={<div>Loading...</div>}>
                    <Word item={item} />
                </Suspense>
            </div>
        </main>
    );
};


export default WordPage;
