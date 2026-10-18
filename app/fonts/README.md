# Local application fonts

Vendored on 2026-10-18 from the official Google Fonts repository:

- [Geist](https://github.com/google/fonts/tree/main/ofl/geist): `Geist[wght].ttf`, `Geist-OFL.txt`.
- [Geist Mono](https://github.com/google/fonts/tree/main/ofl/geistmono): `GeistMono[wght].ttf`, `GeistMono-OFL.txt`.
- [Noto Sans](https://github.com/google/fonts/tree/main/ofl/notosans): `NotoSans[wdth,wght].ttf`, `NotoSans-OFL.txt`.

The accompanying SIL Open Font License files retain their upstream copyright
notices. Only the container format was converted to WOFF2 using FontTools 4.67.0
and Brotli (`TTFont.flavor = 'woff2'`); no subsetting, glyph or axis changes.
Full Latin, IPA and Cyrillic coverage is preserved. Layout uses the same CSS
variables and weight range 100–900 through `next/font/local`.

This avoids a build dependency on Google Fonts responses and the clean-build
failure tracked in https://github.com/vercel/next.js/issues/99114.

| File | SHA-256 |
| --- | --- |
| `Geist.woff2` | `b7d7e9934e6f76aca6c8fe313a17071b137a60bf56b4809bbc656c67f81a0c0b` |
| `GeistMono.woff2` | `8b4ac1bd8ec33688eb27de589878ef28bf9163d2220c0d840155dfaeae33c6b2` |
| `NotoSans.woff2` | `d723faa16b482a1fc8d5b9f934e52f0bcf8bcacc22086e208f566516f0918cf2` |
