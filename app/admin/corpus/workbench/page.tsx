import Link from "next/link"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { withHomonymReviewDb } from "@/lib/corpus/homonymReview"

export default async function WorkbenchIndex({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  await requirePermission(session, Feature.CorpusTokenDisambiguate)
  const params = await searchParams
  const q = (params.q || "").trim().slice(0, 120)
  const page = Math.min(100000, Math.max(1, Number(params.page) || 1)) | 0
  const documents = withHomonymReviewDb((db) => db.prepare(`SELECT slug, title, author FROM CorpusDocument WHERE instr(lower(title), lower(?)) > 0 ORDER BY title, slug LIMIT 31 OFFSET ?`).all(q, (page - 1) * 30) as { slug: string; title: string; author: string | null }[])
  const href = (p: number) => `?${new URLSearchParams({ q, page: String(p) })}`
  return <main className="mx-auto min-h-0 w-full max-w-5xl flex-1 space-y-5 overflow-y-auto p-4">
    <h1 className="text-2xl font-bold">Рабочее место редактора корпуса</h1>
    <p>Выберите документ. Позиция и отложенные вхождения сохраняются в этом браузере отдельно для вашего аккаунта.</p>
    <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Название документа" aria-label="Название документа" className="min-w-0 flex-1 rounded border bg-transparent p-2" /><button className="rounded border px-4">Найти</button></form>
    <ul className="divide-y rounded border">{documents.slice(0, 30).map((d) => <li key={d.slug} className="p-3"><Link className="font-medium underline" href={`/admin/corpus/workbench/${encodeURIComponent(d.slug)}`}>{d.title}</Link>{d.author && <p className="text-sm opacity-70">{d.author}</p>}</li>)}</ul>
    {!documents.length && <p>Документы не найдены.</p>}
    <nav aria-label="Страницы документов" className="flex gap-4">{page > 1 && <Link href={href(page - 1)}>← Назад</Link>}{documents.length > 30 && <Link href={href(page + 1)}>Дальше →</Link>}</nav>
  </main>
}
