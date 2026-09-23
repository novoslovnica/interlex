// Константы, общие для сервера и клиентских компонентов. Отдельный файл -
// чтобы клиентский бандл не тянул за собой translationCards.ts с его
// серверными зависимостями (crypto, better-sqlite3).
export const SUGGESTED_VALUE_MAX_LENGTH = 200
export const VOTE_COMMENT_MAX_LENGTH = 500
