import { describe, it, expect } from "vitest";
import { buildRssFeed, type FeedItem } from "./feed";

const BASE = "https://interslavic-lexicon.com";

function makeItem(overrides: Partial<FeedItem> = {}): FeedItem {
    return {
        title: "byti",
        description: "to be",
        link: `${BASE}/words/1`,
        pubDate: new Date("2026-10-12T08:00:00Z"),
        guid: `${BASE}/words/1`,
        ...overrides,
    };
}

describe("buildRssFeed", () => {
    it("produces a valid RSS 2.0 skeleton with channel metadata", () => {
        const xml = buildRssFeed([makeItem()], BASE);
        expect(xml).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
        expect(xml).toContain(`<rss version="2.0">`);
        expect(xml).toContain("<channel>");
        expect(xml).toContain("</channel>");
        expect(xml).toContain("<title>Interslavic Lexicon — new words and texts</title>");
        expect(xml).toContain(`<link>${BASE}/rss.xml</link>`);
        expect(xml).toContain("<language>en</language>");
        expect(xml).toContain("<lastBuildDate>");
        expect(xml).toContain("<pubDate>");
    });

    it("renders item fields including RFC-822 pubDate", () => {
        const xml = buildRssFeed([makeItem()], BASE);
        expect(xml).toContain("<item>");
        expect(xml).toContain("<title>byti</title>");
        expect(xml).toContain("<description>to be</description>");
        expect(xml).toContain(`<link>${BASE}/words/1</link>`);
        expect(xml).toContain(`<guid>${BASE}/words/1</guid>`);
        // RFC-822: "Mon, 12 Oct 2026 08:00:00 GMT"
        expect(xml).toContain("<pubDate>Mon, 12 Oct 2026 08:00:00 GMT</pubDate>");
    });

    it("escapes & < > \" ' in title and description", () => {
        const xml = buildRssFeed([
            makeItem({
                title: `A & B <tag> "quoted" 'apos'`,
                description: `5 > 3 & "true"`,
            }),
        ], BASE);
        expect(xml).toContain("<title>A &amp; B &lt;tag&gt; &quot;quoted&quot; &apos;apos&apos;</title>");
        expect(xml).toContain("<description>5 &gt; 3 &amp; &quot;true&quot;</description>");
        // no raw special chars inside text nodes
        expect(xml).not.toContain("<title>A & B");
        expect(xml).not.toContain("<description>5 > 3");
    });

    it("omits the item description element when it is empty", () => {
        const xml = buildRssFeed([makeItem({ description: null })], BASE);
        // channel-level <description> stays; the item's one is dropped
        expect(xml.match(/<description>/g)).toHaveLength(1);
    });

    it("orders nothing but sorts inputs as given and uses the latest pubDate for lastBuildDate", () => {
        const older = makeItem({ pubDate: new Date("2026-10-01T00:00:00Z"), guid: `${BASE}/words/2` });
        const newer = makeItem({ pubDate: new Date("2026-10-11T00:00:00Z"), guid: `${BASE}/words/3` });
        const xml = buildRssFeed([older, newer], BASE);
        expect(xml).toContain("<lastBuildDate>Sun, 11 Oct 2026 00:00:00 GMT</lastBuildDate>");
    });

    it("produces an empty-but-valid feed for zero items", () => {
        const xml = buildRssFeed([], BASE);
        expect(xml).toContain("<channel>");
        expect(xml).not.toContain("<item>");
        expect(xml).toContain("<lastBuildDate>");
    });
});
