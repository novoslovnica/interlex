import { describe, it, expect } from "vitest";
import { parseWordIds } from "./mergeLexemes";

describe("parseWordIds", () => {
    it("parses the original flat number[] format", () => {
        const result = parseWordIds("[123, 456]");
        expect(result.isObjFormat).toBe(false);
        expect(result.ids).toEqual([123, 456]);
        expect(result.original).toEqual([123, 456]);
    });

    it("parses the newer {id, flavor}[] format", () => {
        const result = parseWordIds('[{"id":123,"flavor":"CORE"},{"id":456,"flavor":"EAST"}]');
        expect(result.isObjFormat).toBe(true);
        expect(result.ids).toEqual([123, 456]);
        expect(result.original).toEqual([
            { id: 123, flavor: "CORE" },
            { id: 456, flavor: "EAST" },
        ]);
    });

    it("treats an empty array as flat format (no misdetection)", () => {
        const result = parseWordIds("[]");
        expect(result.isObjFormat).toBe(false);
        expect(result.ids).toEqual([]);
    });
});
