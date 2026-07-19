import PlatformAdminNav from "./_nav"

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <PlatformAdminNav />
      {children}
    </div>
  )
}