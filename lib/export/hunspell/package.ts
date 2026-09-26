import AdmZip from "adm-zip"

// Файлы, которые кладутся рядом с .dic/.aff. Расширение LibreOffice (.oxt) -
// zip с манифестом и dictionaries.xcu, ставится двойным щелчком.

export const DICTIONARIES = [
    { id: "isv_Latn", locale: "isv-Latn", title: "Medžuslovjansky (latinica)" },
    { id: "isv_Cyrl", locale: "isv-Cyrl", title: "Меджусловјанскы (кирилица)" },
] as const

export function readme(meta: { version: string; builtAt: string; commit: string | null; stats: Record<string, { words: number; entries: number; classes: number }> }): string {
    const lines = [
        "Interslavic (Medžuslovjansky) spell-checking dictionaries for Hunspell",
        "https://www.interslavic-lexicon.com/downloads",
        "",
        `Version ${meta.version}, built ${meta.builtAt}${meta.commit ? ` from ${meta.commit}` : ""}.`,
        "Generated from the Interslavic Lexicon: every public lexeme, every form the grammar engine produces.",
        "",
        "License: CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/ (full text in LICENSE.txt).",
        "",
        "The etymological spelling is canonical and always accepted (język, sųt, sę, međuslovjansky);",
        "the standard and simplified spellings are accepted as alternatives, and suggestions lead to",
        "the standard one. Both scripts accept the same three spellings of ě:",
        "isv_Latn - Latin script:    člověk (standard), človek (simplified); jezyk, sut, prijatelj.",
        "isv_Cyrl - Cyrillic script: чловєк (standard), чловѣк (etymological ѣ), чловек (simplified);",
        "           језык, сут, пријатељ.",
        "",
        ...Object.entries(meta.stats).map(([id, s]) => `${id}: ${s.words} word forms, ${s.entries} entries, ${s.classes} affix classes`),
        "",
    ]
    return lines.join("\n")
}

function dictionariesXcu(): string {
    const nodes = DICTIONARIES.map((d) => `   <node oor:name="HunSpellDic_${d.id}" oor:op="fuse">
    <prop oor:name="Locations" oor:type="oor:string-list"><value>%origin%/${d.id}.aff %origin%/${d.id}.dic</value></prop>
    <prop oor:name="Format" oor:type="xs:string"><value>DICT_SPELL</value></prop>
    <prop oor:name="Locales" oor:type="oor:string-list"><value>${d.locale}</value></prop>
   </node>`).join("\n")
    return `<?xml version="1.0" encoding="UTF-8"?>
<oor:component-data xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" oor:name="Linguistic" oor:package="org.openoffice.Office">
 <node oor:name="ServiceManager">
  <node oor:name="Dictionaries">
${nodes}
  </node>
 </node>
</oor:component-data>
`
}

function descriptionXml(version: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<description xmlns="http://openoffice.org/extensions/description/2006" xmlns:d="http://openoffice.org/extensions/description/2006" xmlns:xlink="http://www.w3.org/1999/xlink">
  <identifier value="com.interslavic-lexicon.spellcheck" />
  <version value="${version}" />
  <display-name>
    <name lang="en">Interslavic spell checker (Latin and Cyrillic)</name>
    <name lang="ru">Проверка орфографии: межславянский (латиница и кириллица)</name>
  </display-name>
  <publisher><name xlink:href="https://www.interslavic-lexicon.com" lang="en">Interslavic Lexicon</name></publisher>
  <dependencies><OpenOffice.org-minimal-version value="3.0" d:name="OpenOffice.org 3.0" /></dependencies>
</description>
`
}

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="http://openoffice.org/2001/manifest">
  <manifest:file-entry manifest:full-path="dictionaries.xcu" manifest:media-type="application/vnd.sun.star.configuration-data" />
</manifest:manifest>
`

export function buildArchives(files: Record<string, string>, version: string): { zip: Buffer; oxt: Buffer } {
    const zip = new AdmZip()
    for (const [name, content] of Object.entries(files)) zip.addFile(name, Buffer.from(content, "utf8"))

    const oxt = new AdmZip()
    for (const [name, content] of Object.entries(files)) oxt.addFile(name, Buffer.from(content, "utf8"))
    oxt.addFile("META-INF/manifest.xml", Buffer.from(MANIFEST, "utf8"))
    oxt.addFile("dictionaries.xcu", Buffer.from(dictionariesXcu(), "utf8"))
    oxt.addFile("description.xml", Buffer.from(descriptionXml(version), "utf8"))
    return { zip: zip.toBuffer(), oxt: oxt.toBuffer() }
}
