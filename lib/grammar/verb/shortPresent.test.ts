import { describe, it, expect } from "vitest";
import { extractProtoStems, conjugateFullVerb } from "./index";
import { VerbalAspect, AccentParadigm } from "@/lib/grammar/common";
import { stripCombiningAccents } from "@/lib/grammar/morphology/engine";

function conjugate(infinitive: string) {
    const stems = extractProtoStems(infinitive);
    return conjugateFullVerb({
        infinitive,
        infStem: stems.infStem,
        presentStem: stems.presentStem,
        aoristStem: stems.aoristStem,
        verbClass: stems.verbClass,
        aspect: VerbalAspect.IPF,
        paradigm: AccentParadigm.A,
    });
}

// The engine's own accent stripper: it removes only the four combining tone
// marks. A blanket NFD + "drop every combining mark" would also eat the caron
// of "š" and turn znaš into znas.
const strip = stripCombiningAccents;

describe("short present paradigm for -ati verbs", () => {
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

    it("does not give a short paradigm to -iti verbs", () => {
        expect(conjugate("govoriti").indicative.presentOrFutureDirectShort).toBeUndefined();
    });
});
