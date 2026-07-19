import CorpusAdminNav from "./_nav"

export default function CorpusAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <CorpusAdminNav />
      {children}
    </div>
  )
}