import { latexToPlainText } from "./latexToText"

const USER_AGENT = "InterlexCorpusCrawler/1.0 (https://interslavic-lexicon.com; contact: georgecarpow@gmail.com)"
const RAW_BASE = "https://raw.githubusercontent.com/KokunoYumeto/emmy-noether-isv/main/source"

export interface NoetherWork {
    id: string
    title: string
    body: string
}

async function fetchTex(name: string): Promise<string> {
    const res = await fetch(`${RAW_BASE}/${name}`, { headers: { "User-Agent": USER_AGENT } })
    if (!res.ok) throw new Error(`emmy-noether-isv: ${name} -> ${res.status} ${res.statusText}`)
    return res.text()
}

function extractTitle(rawUnitTex: string, fallback: string): string {
    const m = rawUnitTex.match(/\\begin\{center\}[\s\S]*?\{\\Large\\bfseries\s*([\s\S]*?)\}\s*\\par/)
    if (m) {
        const title = latexToPlainText(`\\begin{document}${m[1]}\\end{document}`).replace(/\s+/g, " ").trim()
        if (title) return title
    }
    // Более поздние статьи (14+) не следуют \begin{center}{\Large\bfseries...} -
    // берём первую содержательную строку сконвертированного текста как заголовок.
    const plain = latexToPlainText(`\\begin{document}${rawUnitTex}\\end{document}`)
    const firstLine = plain.split(/\r?\n/).find((l) => l.trim().length > 3)?.trim()
    return firstLine?.slice(0, 150) || fallback
}

/**
 * base-papers1-43-isv.tex собран из "producer units" (машинно сгенерированные
 * маркеры сборки), каждый привязан к конкретной статье через комментарий
 * "% Source: .../paperNN/...". Несколько units на одну статью - конкатенируем
 * их сырой LaTeX по порядку и уже потом конвертируем в текст одним куском
 * (безопаснее, чем чистить каждый unit по отдельности и склеивать текст -
 * не рвёт возможные многострочные конструкции на границе units).
 */
export async function fetchNoetherPapers1to43(): Promise<NoetherWork[]> {
    const tex = await fetchTex("base-papers1-43-isv.tex")

    const unitRe = /% Source: [^\n]*?paper(\d+)[\s\S]*?% BEGIN UNIT BODY\n([\s\S]*?)% END UNIT BODY/g
    const byPaper = new Map<string, string[]>()
    let m: RegExpExecArray | null
    while ((m = unitRe.exec(tex))) {
        const paperNum = m[1].padStart(2, "0")
        const body = m[2]
        if (!byPaper.has(paperNum)) byPaper.set(paperNum, [])
        byPaper.get(paperNum)!.push(body)
    }

    const works: NoetherWork[] = []
    for (const [paperNum, chunks] of [...byPaper.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const rawJoined = chunks.join("\n\n")
        const body = latexToPlainText(`\\begin{document}\n${rawJoined}\n\\end{document}`)
        if (!body) continue
        const title = extractTitle(rawJoined, `Paper ${paperNum}`)
        works.push({ id: `paper${paperNum}`, title, body })
    }
    return works
}

/** 44-book-isv.tex не размечен producer units - делим по \section*{...}. */
export async function fetchNoetherBook44(): Promise<NoetherWork[]> {
    const tex = await fetchTex("44-book-isv.tex")
    const docStart = tex.indexOf("\\begin{document}")
    const body = docStart !== -1 ? tex.slice(docStart) : tex

    const parts = body.split(/(?=\\section\*?\{)/g).filter((p) => /^\\section/.test(p))
    const works: NoetherWork[] = []
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const titleMatch = part.match(/^\\section\*?\{([^}]*)\}/)
        const rawTitle = titleMatch ? titleMatch[1] : `Čest ${i + 1}`
        const title = latexToPlainText(`\\begin{document}${rawTitle}\\end{document}`).trim() || `Čest ${i + 1}`
        const text = latexToPlainText(`\\begin{document}${part}\\end{document}`)
        if (!text) continue
        works.push({ id: `book44-${String(i + 1).padStart(2, "0")}`, title, body: text })
    }
    return works
}

/** 45-isv.tex - одна цельная статья (Statja Kapferera - Noether). */
export async function fetchNoetherPaper45(): Promise<NoetherWork> {
    const tex = await fetchTex("45-isv.tex")
    const body = latexToPlainText(tex)
    const titleMatch = tex.match(/\\begin\{center\}[\s\S]*?\\Large\\textbf\{([\s\S]*?)\}\\\\/)
    const title = titleMatch
        ? latexToPlainText(`\\begin{document}${titleMatch[1]}\\end{document}`).replace(/\s+/g, " ").trim()
        : "Statja Kapferera — Noether"
    return { id: "paper45", title: title || "Statja Kapferera — Noether", body }
}
