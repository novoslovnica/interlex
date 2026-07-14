import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

interface PageParams {
    params: Promise<{ filename: string }>
}

function getCoversDir(): string {
    const dir = process.env.COVERS_DIR || 'public/covers';
    return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
}

export async function GET(request: NextRequest, { params }: PageParams) {
    const { filename } = await params;

    const safe = path.basename(filename);
    const filePath = path.join(getCoversDir(), safe);

    try {
        const fileBuffer = await fs.readFile(filePath);

        const ext = path.extname(safe).toLowerCase();
        const mime: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
        };
        const contentType = mime[ext] || 'application/octet-stream';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch {
        return new NextResponse('File not found', { status: 404 });
    }
}
