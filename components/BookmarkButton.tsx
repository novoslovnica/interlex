'use client'

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTransition, useState, useEffect } from "react"
import { addWordToCollection, removeWordFromCollection } from "@/app/profile/actions"

export default function BookmarkButton({ wordId, className }: { wordId: number; className?: string }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    fetch(`/api/profile/collection/check?wordId=${wordId}`)
      .then(res => res.json())
      .then(data => {
        setIsBookmarked(data.isBookmarked)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [wordId, session])

  if (!session?.user) return null

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (isPending) return

    startTransition(async () => {
      if (isBookmarked) {
        await removeWordFromCollection(wordId)
        setIsBookmarked(false)
      } else {
        await addWordToCollection(wordId)
        setIsBookmarked(true)
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center justify-center p-1 rounded-lg transition-colors cursor-pointer ${
        isBookmarked
          ? "text-yellow-500 hover:text-yellow-600"
          : "text-slate-300 hover:text-yellow-400"
      } ${isPending ? "opacity-50" : ""} ${className || ""}`}
      title={isBookmarked ? "Remove from collection" : "Add to collection"}
      aria-label={isBookmarked ? "Remove from collection" : "Add to collection"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={isBookmarked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.385a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
        />
      </svg>
    </button>
  )
}