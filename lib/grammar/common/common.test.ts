// Пример использования при парсинге словарной статьи из Main DB:
// const dbWord = await prisma.word.findUnique({ where: { id: 1 } });

// const paradigm = isEnumMatch(dbWord?.paradigm, AccentParadigm)
    // ? dbWord.paradigm
    // : AccentParadigm.A; // Безопасный дефолт при некорректных данных
