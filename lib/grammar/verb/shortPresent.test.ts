import { describe, it, expect } from "vitest";
import { buildVerbModel, conjugateFullVerb, conditionalParticles, VerbLexemeInput } from "./index";
import { VerbalAspect, AccentParadigm } from "@/lib/grammar/common";
import { stripCombiningAccents } from "@/lib/grammar/morphology/engine";

function conjugate(head: string, extra: Partial<VerbLexemeInput> = {}) {
    return conjugateFullVerb(buildVerbModel({
        head,
        aspect: VerbalAspect.IPF,
        paradigm: AccentParadigm.A,
        ...extra,
    }));
}

// The engine's own accent stripper: it removes only the four combining tone
// marks. A blanket NFD + "drop every combining mark" would also eat the caron
// of "š" and turn znaš into znas.
const strip = stripCombiningAccents;

describe("short present paradigm", () => {
    it("generates znam/znaš/zna alongside znajų/znaješ/znaje", () => {
        const short = conjugate("znati").indicative.presentOrFutureDirectShort;
        expect(short).toBeDefined();
        expect(strip(short!["1sg"])).toBe("znam");
        expect(strip(short!["2sg"])).toBe("znaš");
        expect(strip(short!["3sg"])).toBe("zna");
        expect(strip(short!["1pl"])).toBe("znamo");
        expect(strip(short!["2pl"])).toBe("znate");
        // 3pl keeps the j the short stem drops elsewhere.
        expect(strip(short!["3pl"])).toBe("znajut");
    });

    it("leaves the full paradigm untouched", () => {
        const full = conjugate("znati").indicative.presentOrFutureDirect;
        expect(strip(full["1sg"])).toBe("znajų");
        expect(strip(full["3sg"])).toBe("znaje");
    });

    // extractProtoStems puts both -ati and -ovati in Leskien class III, so the
    // check has to be on the present stem ("...aje" vs "...uje"), not on the
    // class — otherwise kupovati would wrongly get a short paradigm too.
    it("does not give a short paradigm to -ovati verbs", () => {
        expect(conjugate("kupovati").indicative.presentOrFutureDirectShort).toBeUndefined();
    });

    // učim (1 157 in the corpus) lives next to uču (365).
    it("gives -iti verbs a short 1sg in -im next to the iotated one", () => {
        const conj = conjugate("govoriti");
        expect(strip(conj.indicative.presentOrFutureDirect["1sg"])).toBe("govorjų");
        expect(strip(conj.indicative.presentOrFutureDirectShort!["1sg"])).toBe("govorim");
        expect(strip(conj.indicative.presentOrFutureDirectShort!["2sg"])).toBe("govoriš");
    });

    it("gives -ěje- verbs a short paradigm too (razuměm)", () => {
        const conj = conjugate("razumeti", { stem: "razumě" });
        expect(strip(conj.indicative.presentOrFutureDirect["3pl"])).toBe("razumějųt");
        expect(strip(conj.indicative.presentOrFutureDirectShort!["1sg"])).toBe("razuměm");
    });
});

describe("buildVerbModel", () => {
    it("takes the canonical infinitive from the stem when value lacks diacritics", () => {
        expect(buildVerbModel({ head: "uciti", stem: "uči", aspect: VerbalAspect.IPF, paradigm: AccentParadigm.A }).infinitive).toBe("učiti");
        expect(buildVerbModel({ head: "mogti", stem: "mogti", aspect: VerbalAspect.IPF, paradigm: AccentParadigm.A }).infinitive).toBe("mogti");
    });

    it("treats a present stem in -i as class IV", () => {
        const conj = conjugate("videti", { stem: "vidě", secondaryStem: "vidi" });
        expect(strip(conj.indicative.presentOrFutureDirect["1sg"])).toBe("vidžų");
        expect(strip(conj.indicative.presentOrFutureDirect["3sg"])).toBe("vidi");
        expect(strip(conj.indicative.presentOrFutureDirectShort!["1sg"])).toBe("vidim");
    });
});

describe("class I stems", () => {
    it("inserts j after a vowel stem (čuje)", () => {
        const conj = conjugate("cuti", { stem: "ču" });
        expect(strip(conj.indicative.presentOrFutureDirect["1sg"])).toBe("čujų");
        expect(strip(conj.indicative.presentOrFutureDirect["3sg"])).toBe("čuje");
    });

    it("keeps the velar in 1sg and 3pl (mogų/možeš/mogųt)", () => {
        const conj = conjugate("mogti", { stem: "mogti" });
        const pres = conj.indicative.presentOrFutureDirect;
        expect(strip(pres["1sg"])).toBe("mogų");
        expect(strip(pres["2sg"])).toBe("možeš");
        expect(strip(pres["3pl"])).toBe("mogųt");
        expect(strip(conj.lParticiple.masculine)).toBe("mogl");
    });

    it("builds idi and šel for idti", () => {
        const conj = conjugate("idti", { stem: "id", secondaryStem: "ide", tertiaryStem: "š" });
        expect(strip(conj.imperative["2sg"])).toBe("idi");
        expect(strip(conj.lParticiple.masculine)).toBe("šel");
        expect(strip(conj.lParticiple.feminine)).toBe("šla");
    });

    it("gives byti the sigmatic aorist by", () => {
        expect(strip(conjugate("byti", { stem: "by" }).indicative.aorist["3sg"])).toBe("by");
    });
});

describe("irregular presents", () => {
    it("uses the athematic grids, prefixed forms included", () => {
        expect(strip(conjugate("dati").indicative.presentOrFutureDirect["1sg"])).toBe("dam");
        expect(strip(conjugate("dati").indicative.presentOrFutureDirect["3pl"])).toBe("dadųt");
        expect(strip(conjugate("prodati").indicative.presentOrFutureDirect["1sg"])).toBe("prodam");
        expect(strip(conjugate("vedeti", { stem: "vědě" }).indicative.presentOrFutureDirect["1sg"])).toBe("věm");
        expect(strip(conjugate("byti", { stem: "by" }).indicative.presentOrFutureDirect["3sg"])).toBe("jest");
    });

    it("does not take a word that merely ends the same (gledati)", () => {
        expect(strip(conjugate("gledati").indicative.presentOrFutureDirect["1sg"])).toBe("gledajų");
    });

    it("recognises both hoč- and hč- for hotěti", () => {
        const conj = conjugate("hotěti");
        expect(strip(conj.indicative.presentOrFutureDirect["2sg"])).toBe("hočeš");
        expect(strip(conj.indicative.presentOrFutureDirectShort!["2sg"])).toBe("hčeš");
    });

    it("uses the modern conditional particles", () => {
        expect(conditionalParticles["1sg"]).toBe("byh");
        expect(conditionalParticles["2sg"]).toBe("bys");
    });
});
