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

    // Семантические отношения из RuWordNet
    RelationsManage = "relations_manage",
    HypernymsEdit = "hypernyms_edit",
    HyponymsEdit = "hyponyms_edit",
    MeronymsEdit = "meronyms_edit",
    HolonymsEdit = "holonyms_edit",
    RelatedWordsEdit = "related_words_edit",
    CausesEdit = "causes_edit",
    EffectsEdit = "effects_edit",
    PremisesEdit = "premises_edit",
    ConclusionsEdit = "conclusions_edit",

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

    // Библиотека
    LibraryManage = "library_manage",

    // Конструктор корпуса
    CorpusBuilder = "corpus_builder",

    // Консолидированная семантическая сеть (2026-07-23) — новые типы отношений
    PosSynonymsEdit = "pos_synonyms_edit",
    InstanceOfEdit = "instance_of_edit",
    InstancesEdit = "instances_edit",
    DerivationTargetsEdit = "derivation_targets_edit",
    DerivationSourcesEdit = "derivation_sources_edit",

    // NSM-семантические праймы
    SemanticPrimesManage = "semantic_primes_manage",
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

    // Управление отношениями (общий доступ ко всем 9 типам)
    [SystemFeature.RelationsManage]: {
        label: "Управление отношениями",
        description: "Общий доступ к управлению всеми семантическими отношениями (гиперонимы, гипонимы, меронимы, холонимы, связанные, причины, следствия, предпосылки, заключения)",
        category: "Семантика",
    },

    // Гиперонимы
    [SystemFeature.HypernymsEdit]: {
        label: "Управление гиперонимами",
        description: "Родовые понятия (IS-A): добавление и удаление связей",
        category: "Семантика",
    },

    // Гипонимы
    [SystemFeature.HyponymsEdit]: {
        label: "Управление гипонимами",
        description: "Видовые понятия (IS-A child): добавление и удаление связей",
        category: "Семантика",
    },

    // Меронимы
    [SystemFeature.MeronymsEdit]: {
        label: "Управление меронимами",
        description: "Часть целого (part-of): добавление и удаление связей",
        category: "Семантика",
    },

    // Холонимы
    [SystemFeature.HolonymsEdit]: {
        label: "Управление холонимами",
        description: "Содержит как часть (has-part): добавление и удаление связей",
        category: "Семантика",
    },

    // Связанные слова
    [SystemFeature.RelatedWordsEdit]: {
        label: "Управление связанными словами",
        description: "Связанные понятия: добавление и удаление связей",
        category: "Семантика",
    },

    // Причины
    [SystemFeature.CausesEdit]: {
        label: "Управление причинами",
        description: "Глагольные причины: добавление и удаление связей",
        category: "Семантика",
    },

    // Следствия
    [SystemFeature.EffectsEdit]: {
        label: "Управление следствиями",
        description: "Глагольные следствия: добавление и удаление связей",
        category: "Семантика",
    },

    // Предпосылки
    [SystemFeature.PremisesEdit]: {
        label: "Управление предпосылками",
        description: "Глагольные предпосылки: добавление и удаление связей",
        category: "Семантика",
    },

    // Заключения
    [SystemFeature.ConclusionsEdit]: {
        label: "Управление заключениями",
        description: "Глагольные заключения: добавление и удаление связей",
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

    // Библиотека
    [SystemFeature.LibraryManage]: {
        label: "Управление библиотекой",
        description: "Добавление и редактирование текстов в библиотеке",
        category: "Библиотека",
    },

    // Конструктор корпуса
    [SystemFeature.CorpusBuilder]: {
        label: "Конструктор корпуса",
        description: "Разметка текстов и сохранение в корпус",
        category: "Корпус",
    },

    // Консолидированная семантическая сеть — новые типы отношений
    [SystemFeature.PosSynonymsEdit]: {
        label: "Управление кросс-частеречными синонимами",
        description: "Слова разных частей речи с общим корневым значением (напр. решение↔решать)",
        category: "Семантика",
    },
    [SystemFeature.InstanceOfEdit]: {
        label: "Управление instance-of (экземпляр→класс)",
        description: "Чем это значение является экземпляром (напр. Москва — экземпляр города)",
        category: "Семантика",
    },
    [SystemFeature.InstancesEdit]: {
        label: "Управление instance-of (класс→экземпляры)",
        description: "Какие значения являются экземплярами этого класса",
        category: "Семантика",
    },
    [SystemFeature.DerivationTargetsEdit]: {
        label: "Управление деривацией (что образовано от этого)",
        description: "Словообразовательные производные от данного значения",
        category: "Семантика",
    },
    [SystemFeature.DerivationSourcesEdit]: {
        label: "Управление деривацией (от чего образовано это)",
        description: "От каких значений словообразовательно произведено данное",
        category: "Семантика",
    },

    // NSM-семантические праймы
    [SystemFeature.SemanticPrimesManage]: {
        label: "Управление экспонентами праймов",
        description: "Привязка межславянских значений к семантическим праймам NSM",
        category: "Семантика",
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
