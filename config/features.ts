// 1. Базовые системные фичи
export enum SystemFeature {
    DictionaryCreate = "dictionary_create",
    DictionaryEdit = "dictionary_edit",
    DictionaryDelete = "dictionary_delete",
    ModerationApprove = "moderation_approve",
    LogsView = "logs_view",
    SystemSettings = "system_settings",

    // Детализированные права на слова
    WordsCreate = "words_create",
    WordsEdit = "words_edit",
    WordsDelete = "words_delete",
    WordsNslEdit = "words_nsl_edit",

    // Синонимы и антонимы
    SynonymsEdit = "synonyms_edit",
    AntonymsEdit = "antonyms_edit",

    // Корни (морфемы)
    RootsCreate = "roots_create",
    RootsEdit = "roots_edit",
    RootsDelete = "roots_delete",

    // Окончания (флексии)
    EndingsCreate = "endings_create",
    EndingsEdit = "endings_edit",
    EndingsDelete = "endings_delete",

    // Кандидаты
    CandidatesPromote = "candidates_promote",
    CandidatesDelete = "candidates_delete",

    // Дедупликация
    DeduplicationManage = "deduplication_manage",
}

// 2. Список кодов всех языков из вашей схемы Prisma
export const TRANSLATION_LANGUAGES = [
    { code: "en", name: "Английский", flag: '' },
    { code: "ru", name: "Русский", flag: '🇷🇺' },
    { code: "mk", name: "Македонский", flag: '🇲🇰' },
    { code: "sr", name: "Сербский", flag: '🇷🇸' },
    { code: "uk", name: "Украинский", flag: '🇺🇦' },
    { code: "bg", name: "Болгарский", flag: '🇧🇬' },
    { code: "pl", name: "Польский", flag: '🇵🇱' },
    { code: "be", name: "Белорусский", flag: '🇧🇾' },
    { code: "cs", name: "Чешский", flag: '🇨🇿' },
    { code: "sk", name: "Словацкий", flag: '🇸🇰' },
    { code: "sl", name: "Словенский", flag: '🇸🇮' },
    { code: "hr", name: "Хорватский", flag: '🇭🇷' },
    { code: "hsb", name: "Верхнелужицкий", flag: '' },
    { code: "dsb", name: "Нижнелужицкий", flag: '' },
    { code: "cu", name: "Церковнославянский", flag: '' },
    { code: "de", name: "Немецкий", flag: '' },
    { code: "nl", name: "Нидерландский", flag: '' },
    { code: "eo", name: "Эсперанто", flag: '' },
] as const;

// Генерируем Enum для языковых фич вида: translate_en = "translate_en"
type LanguageFeatureKeys = {
    [K in typeof TRANSLATION_LANGUAGES[number]["code"] as `Translate${Capitalize<K>}`]: `translate_${K}`
};

const LanguageFeature = TRANSLATION_LANGUAGES.reduce((acc, lang) => {
    const enumKey = `Translate${lang.code.toUpperCase()}`;
    const enumValue = `translate_${lang.code}`;
    acc[enumKey] = enumValue;
    return acc;
}, {} as any) as LanguageFeatureKeys;

// 3. Объединенный общий тип Feature для использования во всем проекте
export const Feature = {
    ...SystemFeature,
    ...LanguageFeature,
};
export type Feature = SystemFeature | `translate_${typeof TRANSLATION_LANGUAGES[number]["code"]}`;

// 4. Описываем метаданные для базовых системных фич
export const FEATURE_METADATA: Record<string, { label: string; description: string; category: string }> = {
    [SystemFeature.DictionaryCreate]: {
        label: "Создание статей",
        description: "Доступ к форме создания слов и корней",
        category: "Словарь",
    },
    [SystemFeature.DictionaryEdit]: {
        label: "Редактирование статей",
        description: "Изменение существующих словарных статей",
        category: "Словарь",
    },
    [SystemFeature.DictionaryDelete]: {
        label: "Удаление данных",
        description: "Право безвозвратно удалять слова и корни",
        category: "Словарь",
    },
    [SystemFeature.ModerationApprove]: {
        label: "Верификация (Аппрув)",
        description: "Возможность ставить маркер 'Проверено'",
        category: "Модерация",
    },
    [SystemFeature.LogsView]: {
        label: "Просмотр логов",
        description: "Доступ к аудиту действий модераторов",
        category: "Система",
    },
    [SystemFeature.SystemSettings]: {
        label: "Управление конфигурацией",
        description: "Изменение глобальных переменных окружения",
        category: "Система",
    },

    // Детализированные права на слова
    [SystemFeature.WordsCreate]: {
        label: "Создание слов",
        description: "Создание новых словарных статей",
        category: "Слова",
    },
    [SystemFeature.WordsEdit]: {
        label: "Редактирование слов",
        description: "Изменение основных полей словарных статей",
        category: "Слова",
    },
    [SystemFeature.WordsDelete]: {
        label: "Удаление слов",
        description: "Безвозвратное удаление словарных статей",
        category: "Слова",
    },
    [SystemFeature.WordsNslEdit]: {
        label: "Редактирование NSL",
        description: "Изменение поля NSL (allophone) у слов",
        category: "Слова",
    },

    // Синонимы
    [SystemFeature.SynonymsEdit]: {
        label: "Управление синонимами",
        description: "Добавление и удаление связей синонимов между значениями",
        category: "Семантика",
    },

    // Антонимы
    [SystemFeature.AntonymsEdit]: {
        label: "Управление антонимами",
        description: "Добавление и удаление связей антонимов между значениями",
        category: "Семантика",
    },

    // Корни
    [SystemFeature.RootsCreate]: {
        label: "Создание корней",
        description: "Создание новых корней (морфем)",
        category: "Корни и окончания",
    },
    [SystemFeature.RootsEdit]: {
        label: "Редактирование корней",
        description: "Изменение существующих корней",
        category: "Корни и окончания",
    },
    [SystemFeature.RootsDelete]: {
        label: "Удаление корней",
        description: "Удаление корней из базы",
        category: "Корни и окончания",
    },

    // Окончания
    [SystemFeature.EndingsCreate]: {
        label: "Создание окончаний",
        description: "Создание новых флексий",
        category: "Корни и окончания",
    },
    [SystemFeature.EndingsEdit]: {
        label: "Редактирование окончаний",
        description: "Изменение существующих окончаний",
        category: "Корни и окончания",
    },
    [SystemFeature.EndingsDelete]: {
        label: "Удаление окончаний",
        description: "Удаление окончаний из базы",
        category: "Корни и окончания",
    },

    // Кандидаты
    [SystemFeature.CandidatesPromote]: {
        label: "Публикация кандидатов",
        description: "Продвижение кандидатов в основные леммы",
        category: "Кандидаты",
    },
    [SystemFeature.CandidatesDelete]: {
        label: "Удаление кандидатов",
        description: "Отклонение и удаление кандидатов",
        category: "Кандидаты",
    },

    // Дедупликация
    [SystemFeature.DeduplicationManage]: {
        label: "Дедупликация",
        description: "Слияние дублирующихся слов",
        category: "Слова",
    },
};

// 5. Автоматически дополняем метаданные разрешениями по всем языкам из БД
TRANSLATION_LANGUAGES.forEach((lang) => {
    const featureKey = `translate_${lang.code}`;
    FEATURE_METADATA[featureKey] = {
        label: `Перевод: ${lang.name} (${lang.code.toUpperCase()})`,
        description: `Разрешить редактировать и добавлять перевод на ${lang.name.toLowerCase()} язык`,
        category: "Переводы", // Ваша новая категория
    };
});

// 6. Формируем итоговую группировку для двухколоночного интерфейса управления пользователями
export const FEATURE_CATEGORIES = Object.entries(FEATURE_METADATA).reduce(
    (acc, [key, meta]) => {
        const category = meta.category;
        if (!acc[category]) acc[category] = [];
        acc[category].push({
            key: key as Feature,
            label: meta.label,
            description: meta.description,
        });
        return acc;
    },
    {} as Record<string, Array<{ key: Feature; label: string; description: string }>>
);
