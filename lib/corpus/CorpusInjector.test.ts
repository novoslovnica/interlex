import { CorpusInjector } from "./CorpusInjector";

const injector = new CorpusInjector();

const sampleText = "Drugi dom byl veliky. Profesori rabotajut tam medlenno!";

injector.injectDocument({
    title: "Primer teksta za korpus",
    slug: "primer-teksta-2026",
    rawText: sampleText,
    author: "Jan Van Steenbergen",
    language: "is"
})
    .then(res => console.log(`Успешно обработано токенов: ${res.tokensProcessed}`))
    .catch(err => console.error(err));
