export interface TeiToken {
  surfaceForm: string
  lemma: string
  pos: string
  wordIndex: number
  matchCount: number
  wordSlug: string | null
  feats: Record<string, string>
}

export interface TeiSentence {
  position: number
  tokens: TeiToken[]
}

export interface TeiSegment {
  position: number
  sentences: TeiSentence[]
}

export interface TeiDocument {
  title: string
  author: string | null
  segments: TeiSegment[]
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function encodeFeats(feats: Record<string, string>): string {
  const parts: string[] = []
  for (const [key, val] of Object.entries(feats)) {
    if (val && val !== "") {
      parts.push(`${key}=${val}`)
    }
  }
  return parts.join("; ")
}

function posToTeiTag(pos: string): string {
  const tagMap: Record<string, string> = {
    NOUN: "n",
    VERB: "v",
    ADJ: "adj",
    ADV: "adv",
    PRON: "pron",
    NUM: "num",
    ADP: "prep",
    CONJ: "cc",
    SCONJ: "cs",
    PART: "part",
    INTJ: "intj",
    DET: "det",
    AUX: "v",
    PUNCT: "punct",
    X: "x",
  }
  return tagMap[pos] || pos.toLowerCase()
}

export function generateTeiXml(doc: TeiDocument): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="http://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>${escapeXml(doc.title)}</title>
        ${doc.author ? `<author>${escapeXml(doc.author)}</author>` : ""}
      </titleStmt>
      <publicationStmt>
        <publisher>Interslavic Lexicon</publisher>
        <idno type="URL">https://interslavic-lexicon.com/corpus</idno>
      </publicationStmt>
      <sourceDesc>
        <p>Generated from the Interslavic Lexicon corpus at interslavic-lexicon.com</p>
      </sourceDesc>
    </fileDesc>
    <encodingDesc>
      <projectDesc>
        <p>Tokenized and annotated by the Interslavic Lexicon morphological analyzer (DbAnalyzer)</p>
      </projectDesc>
      <tagsDecl>
        <rendition xml:id="green">exact match: full morphological analysis available</rendition>
        <rendition xml:id="yellow">partial match: stem recognized, generated form not found in grammar</rendition>
        <rendition xml:id="red">unrecognized: not found in lexicon</rendition>
      </tagsDecl>
    </encodingDesc>
  </teiHeader>
  <text>
    <body>`

  const segments = doc.segments.map((seg) => {
    const sentences = seg.sentences.map((sent) => {
      const tokens = sent.tokens.map((t) => {
        const normalized = t.surfaceForm
        const attrs = `lemma="${escapeXml(t.lemma)}" pos="${escapeXml(posToTeiTag(t.pos))}"`

        const featsAttr = Object.keys(t.feats).length > 0 ? ` ana="${escapeXml(encodeFeats(t.feats))}"` : ""

        if (t.matchCount === 0) {
          if (t.wordIndex === -1) {
            return `<pc>${escapeXml(normalized)}</pc>`
          }
          return `<w ${attrs}${featsAttr} cert="low">${escapeXml(normalized)}</w>`
        }

        if (t.wordIndex === -1) {
          return `<pc>${escapeXml(normalized)}</pc>`
        }

        let anaAttr = featsAttr
        if (t.matchCount > 1) {
          anaAttr = ` ana="${escapeXml(encodeFeats(t.feats))}"`
        }

        return `<w ${attrs}${anaAttr}>${escapeXml(normalized)}</w>`
      })

      const spaceTokens: string[] = []
      for (let i = 0; i < tokens.length; i++) {
        if (i > 0) {
          spaceTokens.push(" ")
        }
        spaceTokens.push(tokens[i])
      }

      return `        <s n="${sent.position + 1}">${spaceTokens.join("")}</s>`
    })

    return `      <div type="segment" n="${seg.position + 1}">
${sentences.join("\n")}
      </div>`
  })

  const body = segments.join("\n")

  const footer = `    </body>
  </text>
</TEI>`

  return header + "\n" + body + "\n" + footer + "\n"
}