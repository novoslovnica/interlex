/**
 * Грубый, но достаточный для лингвистического корпуса конвертер LaTeX -> текст
 * для источника emmy-noether-isv (см. AGENTS.md/обсуждение) - не претендует
 * на полный рендер, только вычищает разметку и формулы, оставляя прозу.
 * Формулы ($...$, \[...\], окружения equation/align) и сноски (\footnote{})
 * выбрасываются целиком - для корпусной статистики полезен связный
 * межславянский текст, не математическая нотация или обрывки сносок
 * посреди предложения.
 */

function stripBalancedMacroArgs(text: string, macroNames: string[]): string {
    let result = text
    for (const name of macroNames) {
        const re = new RegExp(`\\\\${name}\\*?\\{`, "g")
        let match: RegExpExecArray | null
        while ((match = re.exec(result))) {
            const start = match.index
            const argStart = start + match[0].length
            let depth = 1
            let i = argStart
            while (i < result.length && depth > 0) {
                if (result[i] === "{") depth++
                else if (result[i] === "}") depth--
                i++
            }
            result = result.slice(0, start) + result.slice(argStart, i - 1) + result.slice(i)
            re.lastIndex = start
        }
    }
    return result
}

function dropBalancedMacroArgs(text: string, macroNames: string[]): string {
    let result = text
    for (const name of macroNames) {
        const re = new RegExp(`\\\\${name}\\*?\\{`, "g")
        let match: RegExpExecArray | null
        while ((match = re.exec(result))) {
            const start = match.index
            const argStart = start + match[0].length
            let depth = 1
            let i = argStart
            while (i < result.length && depth > 0) {
                if (result[i] === "{") depth++
                else if (result[i] === "}") depth--
                i++
            }
            result = result.slice(0, start) + result.slice(i)
            re.lastIndex = start
        }
    }
    return result
}

const MATH_ENVIRONMENTS = ["equation", "equation\\*", "align", "align\\*", "gather", "gather\\*", "multline", "multline\\*"]

export function latexToPlainText(tex: string): string {
    let t = tex

    // преамбула (до \begin{document}) - только макросы пакета, не текст
    const docStart = t.indexOf("\\begin{document}")
    if (docStart !== -1) t = t.slice(docStart + "\\begin{document}".length)

    // построчные комментарии (не трогая экранированный \%)
    t = t.replace(/(^|[^\\])%.*$/gm, "$1")

    // формулы
    t = t.replace(/\$\$[\s\S]*?\$\$/g, " ")
    t = t.replace(/\$[^$]*\$/g, " ")
    t = t.replace(/\\\[[\s\S]*?\\\]/g, " ")
    for (const env of MATH_ENVIRONMENTS) {
        t = t.replace(new RegExp(`\\\\begin\\{${env}\\}[\\s\\S]*?\\\\end\\{${env}\\}`, "g"), " ")
    }

    // сноски целиком (текст сноски не встраиваем посреди предложения)
    t = dropBalancedMacroArgs(t, ["footnote", "footnotetext"])

    // окружения-обёртки: снимаем begin/end, содержимое остаётся
    t = t.replace(/\\begin\{[a-zA-Z*]+\}(\[[^\]]*\])?/g, "")
    t = t.replace(/\\end\{[a-zA-Z*]+\}/g, "")

    // форматирующие макросы с одним аргументом - разворачиваем, текст остаётся
    t = stripBalancedMacroArgs(t, [
        "textbf", "textit", "emph", "text", "textsuperscript", "textsubscript",
        "foreign", "part", "chapter", "section", "subsection", "subsubsection",
        "caption", "title", "author",
    ])

    // управляющие последовательности без аргументов/со спецсимволами
    t = t.replace(/\\(clearpage|newpage|par|noindent|smallskip|medskip|bigskip|begingroup|endgroup|allowbreak)\b/g, " ")
    t = t.replace(/\\(Large|large|normalsize|small|footnotesize|bfseries|itshape|mdseries|upshape)\b/g, "")
    t = t.replace(/\\setcounter\{[^}]*\}\{[^}]*\}/g, "")
    t = t.replace(/\\setlength\{[^}]*\}\{[^}]*\}/g, "")
    t = t.replace(/\\addcontentsline\{[^}]*\}\{[^}]*\}\{[^}]*\}/g, "")
    t = t.replace(/\\hspace\{[^}]*\}|\\vspace\{[^}]*\}/g, " ")
    t = t.replace(/\\label\{[^}]*\}/g, "")
    t = t.replace(/\\cite[a-zA-Z]*\{[^}]*\}/g, "")
    t = t.replace(/\\ref\{[^}]*\}/g, "")
    t = t.replace(/\\rule\{[^}]*\}\{[^}]*\}/g, "")
    t = t.replace(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g, "")

    // экранированные и типографские символы
    t = t.replace(/\\\\/g, "\n")
    t = t.replace(/~/g, " ")
    t = t.replace(/\\,/g, " ")
    t = t.replace(/\\%/g, "%")
    t = t.replace(/\\&/g, "&")

    // оставшиеся неизвестные однословные макросы (напр. \emergencystretch=4em) и мусорные скобки
    t = t.replace(/\\[a-zA-Z]+(=\S+)?/g, " ")
    t = t.replace(/[{}]/g, "")

    // схлопываем пробелы
    t = t.replace(/[ \t]+/g, " ")
    t = t.replace(/\n[ \t]*\n[ \t]*(\n[ \t]*)+/g, "\n\n")
    t = t.replace(/[ \t]+\n/g, "\n")
    return t.trim()
}
