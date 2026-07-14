declare module "epub-gen" {
  interface EPubContent {
    title?: string
    data: string
    author?: string | string[]
    excludeFromToc?: boolean
    beforeToc?: boolean
    filename?: string
    url?: string
  }

  interface EPubOptions {
    title: string
    author?: string | string[]
    publisher?: string
    description?: string
    cover?: string
    tocTitle?: string
    appendChapterTitles?: boolean
    date?: string
    lang?: string
    fonts?: string[]
    version?: 2 | 3
    output?: string
    tempDir?: string
    css?: string
    customOpfTemplatePath?: string
    customNcxTocTemplatePath?: string
    customHtmlTocTemplatePath?: string
    verbose?: boolean
    content: EPubContent[]
  }

  class EPub {
    constructor(options: EPubOptions, output?: string)
    promise: Promise<void>
  }

  export default EPub
}