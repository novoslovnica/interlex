import Link from "next/link"

export default function Footer() {
    return (
        <footer className="w-full bg-[#1e293b] text-white flex-shrink-0">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                <nav className="flex flex-col md:flex-row md:items-center gap-2 md:gap-5">
                    <Link href="/proto" className="text-sm text-[#cbd5e1] hover:text-white transition-colors">Праслав.</Link>
                    <Link href="/library" className="text-sm text-[#cbd5e1] hover:text-white transition-colors">Библиотека</Link>
                    <Link href="/textbook/ru" className="text-sm text-[#cbd5e1] hover:text-white transition-colors">Учебник</Link>
                    <Link href="/about" className="text-sm text-[#cbd5e1] hover:text-white transition-colors">О программе</Link>
                </nav>
                <span className="text-sm text-[#94a3b8] whitespace-nowrap">© Interslavic Lexicon 2026</span>
            </div>
        </footer>
    )
}