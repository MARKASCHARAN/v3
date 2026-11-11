'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StoredAuthSession, useAuthSession } from '@/lib/auth-storage';

export const useRequireAuth = (): StoredAuthSession | null => {
  const router = useRouter();
  const session = useAuthSession();

  useEffect(() => {
    if (!session?.accessToken) {
      router.replace('/login');
    }
  }, [router, session]);

  return session;
};

