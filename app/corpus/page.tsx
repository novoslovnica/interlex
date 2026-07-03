const Corpus = () => {
    const match = {

    }

    return (
        // Пример строки в вашей Tailwind-таблице результатов:
        <div className="grid grid-cols-12 gap-2 font-mono text-sm my-1">
            {/* Левый контекст (выравнивание по правому краю) */}
            <div className="col-span-5 text-right text-gray-500 truncate">
                {match.leftContext}
            </div>

            {/* Ключевое слово (в центре, выделено) */}
            <div className="col-span-2 text-center font-bold text-blue-600 bg-blue-50 rounded px-1">
                {match.keyword}
            </div>

            {/* Правый контекст (выравнивание по левому краю) */}
            <div className="col-span-5 text-left text-gray-500 truncate">
                {match.rightContext}
            </div>
        </div>
    );
}

export default Corpus;