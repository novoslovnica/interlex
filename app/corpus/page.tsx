import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Корпус текстов",
  description: "Поиск по корпусу текстов на межславянском языке. Конкорданс и анализ словоупотребления в параллельных текстах.",
};

const Corpus = () => {
    const match = {

    }

    return (
        <div className="grid grid-cols-12 gap-2 font-mono text-sm my-1">
            <div className="col-span-5 text-right text-gray-500 truncate">
                {match.leftContext}
            </div>
            <div className="col-span-2 text-center font-bold text-blue-600 bg-blue-50 rounded px-1">
                {match.keyword}
            </div>
            <div className="col-span-5 text-left text-gray-500 truncate">
                {match.rightContext}
            </div>
        </div>
    );
}

export default Corpus;