'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import InfiniteEditableTable from './InfiniteEditableTable';

export default function TablePage({ initialColumnVisibility, onSaveColumnVisibility }: { initialColumnVisibility?: string | null, onSaveColumnVisibility: (json: string) => Promise<void> }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            <main>
                <InfiniteEditableTable initialColumnVisibility={initialColumnVisibility ?? null} onSaveColumnVisibility={onSaveColumnVisibility} />
            </main>
        </QueryClientProvider>
    );
}
