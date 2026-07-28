import { prismaCorpus } from '@/lib/prisma';
import { DependencyEdge } from './types';

/**
 * Перезаписывает автоматически сгенерированные рёбра для предложения.
 * Затрагивает только source='auto' — ручные правки (Фаза 5, /admin/corpus/syntax)
 * не удаляются, тот же приём, что и у реимпорта semantic_relations (см.
 * AGENTS.md "Semantic Network"): реимпорт не должен тихо затирать то, что
 * уже поправил модератор.
 *
 * Через prismaCorpus, а не сырой SQL — в отличие от DDL/миграций (см.
 * scripts/db/2026-07-27-add-corpus-syntax-tables.ts и его комментарий про
 * отсутствие _prisma_migrations в corpus.db), обычные CRUD-операции через
 * Prisma-клиент работают нормально независимо от статуса миграций; это и
 * есть путь, которым пишет весь остальной app/api/admin/corpus/**.
 */
export async function saveDependencies(sentenceId: string, edges: DependencyEdge[]): Promise<void> {
    await prismaCorpus.$transaction(async tx => {
        await tx.corpusDependency.deleteMany({ where: { sentenceId, source: 'auto' } });
        if (edges.length === 0) return;
        await tx.corpusDependency.createMany({
            data: edges.map(e => ({
                sentenceId,
                headTokenId: e.headTokenId === null || e.headTokenId === undefined ? null : BigInt(e.headTokenId),
                depTokenId: BigInt(e.depTokenId),
                relation: e.relation,
                confidence: e.confidence,
                source: 'auto',
            })),
        });
    });
}
