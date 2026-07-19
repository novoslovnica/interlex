import { redirect } from "next/navigation"

export default async function OldAdminLibraryEditRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/platform/library/${id}/edit`)
}