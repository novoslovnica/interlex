'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import InfiniteEditableTable from './InfiniteEditableTable';

export default function TablePage() {
    // Создаем изолированный клиент прямо здесь
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            <main className="p-8">
                <h1 className="text-2xl font-bold mb-4">Бесконечная таблица</h1>
                <InfiniteEditableTable />
            </main>
        </QueryClientProvider>
    );
}
