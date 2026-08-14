// Общий парсер формата CoNLL-U (UD-трибанки: PROIEL, Birchbark, CLARIN Balkan
// Slavic и т.п.). Намеренно не знает ничего специфичного под конкретный
// источник (напр. про поле "wf" в MISC у Birchbark, или про "newdoc id") —
// это дело импортёра конкретного источника, парсер отдаёт комментарии как
// плоский снэпшот key->value на момент каждого предложения.
//
// Формат: https://universaldependencies.org/format.html
// Комментарии "# key = value" накапливаются построчно (в т.ч. document-level
// маркеры типа "# newdoc id = ..." / "# date_created = ..."), которые в UD
// пишутся один раз перед первым предложением документа и не повторяются —
// поэтому просто мержим их в общий словарь и делаем снэпшот на каждое
// предложение, не сбрасывая между предложениями (per-sentence поля вроде
// sent_id/text всё равно переопределяются заново в каждом блоке).

export interface ConlluToken {
    index: number
    form: string
    lemma: string
    upos: string
    feats: Record<string, string> | null
    misc: Record<string, string> | null
}

export interface ConlluSentence {
    comments: Record<string, string>
    tokens: ConlluToken[]
}

function parseKeyValuePairs(raw: string): Record<string, string> {
    // "Key1=Value1|Key2=\"Value with spaces\"|Key3"
    const result: Record<string, string> = {}
    if (!raw || raw === "_") return result
    for (const pair of raw.split("|")) {
        const eq = pair.indexOf("=")
        if (eq === -1) {
            result[pair.trim()] = "true"
            continue
        }
        const key = pair.slice(0, eq).trim()
        let value = pair.slice(eq + 1).trim()
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
        result[key] = value
    }
    return result
}

export function parseConllu(raw: string): ConlluSentence[] {
    const sentences: ConlluSentence[] = []
    const runningComments: Record<string, string> = {}
    let currentTokens: ConlluToken[] = []
    let sentenceHasTokens = false

    const flush = () => {
        if (sentenceHasTokens) {
            sentences.push({ comments: { ...runningComments }, tokens: currentTokens })
        }
        currentTokens = []
        sentenceHasTokens = false
    }

    const lines = raw.split(/\r?\n/)
    for (const line of lines) {
        if (line.trim() === "") {
            flush()
            continue
        }
        if (line.startsWith("#")) {
            const body = line.slice(1).trim()
            const eq = body.indexOf("=")
            if (eq !== -1) {
                const key = body.slice(0, eq).trim()
                const value = body.slice(eq + 1).trim()
                runningComments[key] = value
            }
            continue
        }

        const cols = line.split("\t")
        if (cols.length < 10) continue
        const [id, form, lemma, upos, , feats, , , , misc] = cols

        // Пропускаем диапазоны многословных токенов ("3-4") и пустые узлы
        // эллипсиса ("3.1") — нас интересуют только обычные пронумерованные токены.
        if (!/^\d+$/.test(id)) continue

        currentTokens.push({
            index: parseInt(id, 10),
            form,
            lemma,
            upos,
            feats: feats && feats !== "_" ? parseKeyValuePairs(feats) : null,
            misc: misc && misc !== "_" ? parseKeyValuePairs(misc) : null,
        })
        sentenceHasTokens = true
    }
    flush()

    return sentences
}
