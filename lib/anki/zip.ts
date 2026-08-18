// Minimal ZIP archive writer (STORE method only, no compression) - just
// enough to produce a spec-valid .apkg, which is a plain ZIP container.
// No external zip dependency exists in this project, and .apkg's small
// payload (a SQLite db + a media manifest) doesn't need deflate to be a
// reasonable file size, so uncompressed entries keep this self-contained.

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(data: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntryInput {
    name: string;
    data: Buffer;
}

interface WrittenEntry extends ZipEntryInput {
    crc: number;
    offset: number;
}

export function buildZip(entries: ZipEntryInput[]): Buffer {
    const chunks: Buffer[] = [];
    const written: WrittenEntry[] = [];
    let offset = 0;

    // DOS date/time for 1980-01-01 00:00:00 - .apkg contents have no
    // meaningful "modified" time for Anki's import logic to care about.
    const dosTime = 0;
    const dosDate = 0b0000000000100001;

    for (const entry of entries) {
        const nameBuf = Buffer.from(entry.name, "utf8");
        const crc = crc32(entry.data);
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(0, 6);
        header.writeUInt16LE(0, 8);
        header.writeUInt16LE(dosTime, 10);
        header.writeUInt16LE(dosDate, 12);
        header.writeUInt32LE(crc, 14);
        header.writeUInt32LE(entry.data.length, 18);
        header.writeUInt32LE(entry.data.length, 22);
        header.writeUInt16LE(nameBuf.length, 26);
        header.writeUInt16LE(0, 28);

        chunks.push(header, nameBuf, entry.data);
        written.push({ ...entry, crc, offset });
        offset += header.length + nameBuf.length + entry.data.length;
    }

    const centralDirStart = offset;
    for (const entry of written) {
        const nameBuf = Buffer.from(entry.name, "utf8");
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(dosTime, 12);
        central.writeUInt16LE(dosDate, 14);
        central.writeUInt32LE(entry.crc, 16);
        central.writeUInt32LE(entry.data.length, 20);
        central.writeUInt32LE(entry.data.length, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(entry.offset, 42);

        chunks.push(central, nameBuf);
        offset += central.length + nameBuf.length;
    }
    const centralDirSize = offset - centralDirStart;

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(written.length, 8);
    eocd.writeUInt16LE(written.length, 10);
    eocd.writeUInt32LE(centralDirSize, 12);
    eocd.writeUInt32LE(centralDirStart, 16);
    eocd.writeUInt16LE(0, 20);
    chunks.push(eocd);

    return Buffer.concat(chunks);
}
