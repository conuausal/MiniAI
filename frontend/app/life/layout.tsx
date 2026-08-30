import Topbar from '@/components/Topbar';
import LifeSidebar from '@/components/LifeSidebar';

export default function LifeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-bg">
      <Topbar />
      <div className="flex-1 flex overflow-hidden">
        <LifeSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
