"use client"

import { useFormStatus } from "react-dom"

export function DeleteButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="px-2 py-1 text-xs rounded border text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
      onClick={e => { if (!confirm("Удалить текст?")) e.preventDefault() }}
    >
      {pending ? "Удаление..." : "Удалить"}
    </button>
  )
}