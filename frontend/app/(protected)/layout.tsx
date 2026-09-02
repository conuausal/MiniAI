'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="h-dvh grid place-items-center bg-bg">
        <div className="text-text-mute text-sm animate-pulse-soft">加载中…</div>
      </div>
    );
  }
  return <>{children}</>;
}
