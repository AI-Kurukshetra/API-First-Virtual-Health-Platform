'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

export default function AuthRedirect() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);

  React.useEffect(() => {
    if (!session) return;
    if (session.user.role === 'patient') {
      router.replace('/patient/dashboard');
    } else {
      router.replace('/doctor/dashboard');
    }
  }, [session, router]);

  return null;
}
