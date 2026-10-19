import { describe, expect, it } from "vitest"
import { readWorkspace, samePosition, shortcut } from "./workbenchClientState"
const event = (key: string, ctrlKey = false) => ({ key, ctrlKey, metaKey: false, altKey: false, shiftKey: false })
describe("workbench browser state", () => {
  it("restores bounded, validated personal progress and rejects invalid storage", () => {
    expect(readWorkspace("broken")).toEqual({ deferred: [], filter: "problems", script: "original" })
    const position = { id: "12", surfaceForm: "je", tokenIndex: 5 }
    expect(readWorkspace(JSON.stringify({ version: 1, position, deferred: [null, position, { id: "-1" }], filter: "manual", script: "cyrillic" }))).toEqual({ position, deferred: [position], filter: "manual", script: "cyrillic" })
    expect(readWorkspace(JSON.stringify({ version: 1, deferred: Array(700).fill(position) })).deferred).toHaveLength(500)
    expect(samePosition(position, { ...position, surfaceForm: "jeste" })).toBe(false)
  })
  it("never treats typing numbers/navigation letters as editor commands", () => {
    for (const key of ["1", "j", "k", "d", "ArrowRight"]) expect(shortcut(event(key), true)).toBeNull()
    expect(shortcut(event("1"), false)).toBe(0)
    expect(shortcut(event("Enter", true), true)).toBe("saveNext")
    expect(shortcut(event("s", true), true)).toBe("save")
    expect(shortcut({ ...event("ы", true), code: "KeyS" }, true)).toBe("save")
    expect(shortcut({ ...event("d"), altKey: true }, false)).toBeNull()
    expect(shortcut({ ...event("Enter"), metaKey: true }, true)).toBe("saveNext")
  })
})
