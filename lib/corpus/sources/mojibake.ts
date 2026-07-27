/**
 * interslavic.news отдаёт страницы как UTF-8, но часть славянских диакритик
 * (ž, š, á, é, – и т.п.) в БД сохранена как одиночные байты Windows-1252/CP1250
 * (0x80–0x9F), а не как корректные многобайтовые UTF-8-последовательности —
 * классическая mojibake старого PHP-сайта. Подтверждено эмпирически: почти
 * все статьи (33/44 в выборке) содержат такие байты, включая слово
 * "Med�uslovjansky" вместо "Medžuslovjansky" при обычном utf-8 decode.
 *
 * Байты 0xA0–0xFF совпадают между Windows-1252 и Latin-1, поэтому таблица
 * нужна только для диапазона 0x80–0x9F.
 */
const WIN1252_HIGH: Record<number, string> = {
    0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„",
    0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ",
    0x89: "‰", 0x8A: "Š", 0x8B: "‹", 0x8C: "Œ",
    0x8E: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“",
    0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
    0x98: "˜", 0x99: "™", 0x9A: "š", 0x9B: "›",
    0x9C: "œ", 0x9E: "ž", 0x9F: "Ÿ",
}

function utf8SequenceLength(lead: number): number {
    if (lead < 0x80) return 1
    if ((lead & 0xe0) === 0xc0) return 2
    if ((lead & 0xf0) === 0xe0) return 3
    if ((lead & 0xf8) === 0xf0) return 4
    return 0
}

function isContinuation(byte: number | undefined): boolean {
    return byte !== undefined && (byte & 0xc0) === 0x80
}

/**
 * Декодирует буфер как UTF-8, а любой байт, который не может быть началом
 * или продолжением корректной UTF-8-последовательности, интерпретирует как
 * одиночный символ Windows-1252 (для 0xA0–0xFF это совпадает с Latin-1).
 */
export function repairMojibakeUtf8(buffer: Buffer): string {
    let out = ""
    let i = 0

    while (i < buffer.length) {
        const lead = buffer[i]
        const seqLen = utf8SequenceLength(lead)

        if (seqLen > 0) {
            let valid = true
            for (let j = 1; j < seqLen; j++) {
                if (!isContinuation(buffer[i + j])) {
                    valid = false
                    break
                }
            }
            if (valid) {
                out += buffer.subarray(i, i + seqLen).toString("utf-8")
                i += seqLen
                continue
            }
        }

        out += WIN1252_HIGH[lead] ?? String.fromCharCode(lead)
        i += 1
    }

    return out
}
