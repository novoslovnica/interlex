/**
 * interslavic.news/izvesti.info — старый, слабо поддерживаемый хостинг
 * (PHP Deprecated-варнинги в каждом ответе), эмпирически рвёт TCP-соединение
 * на части запросов ("SocketError: other side closed"). Ретраит только
 * сетевые сбои самого fetch — HTTP-статусы (включая 404, которые клиенты
 * используют как "статьи не существует") возвращаются как есть.
 */
export async function fetchWithRetry(url: string, init: RequestInit, retries = 3, backoffMs = 1000): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fetch(url, init)
        } catch (err) {
            if (attempt >= retries) throw err
            await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt))
        }
    }
}
