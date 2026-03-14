'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ActivitySquare,
  CalendarClock,
  FileText,
  LayoutDashboard,
  PlusCircle,
  UsersRound
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((state) => state.session);
  const hydrated = useAuthStore((state) => state.hydrated);
  const clearSession = useAuthStore((state) => state.clearSession);

  React.useEffect(() => {
    if (hydrated && !session) {
      router.push('/login');
    }
  }, [hydrated, session, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbf9_0%,#f1f8f5_100%)]">
        <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
          <div className="rounded-[28px] border border-[#dbe7df] bg-white/92 px-6 py-5 text-sm font-semibold text-muted shadow-[0_18px_40px_rgba(11,31,26,0.08)]">
            Restoring workspace session...
          </div>
        </main>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const isDoctorShell = session.user.role !== 'patient';
  const navigationItems = isDoctorShell
    ? [
        {
          label: 'Overview',
          href: '/doctor/dashboard',
          icon: LayoutDashboard,
          active: pathname === '/doctor/dashboard'
        },
        {
          label: 'Patients',
          href: '/doctor/patients',
          icon: UsersRound,
          active: pathname.startsWith('/doctor/patients')
        },
        {
          label: 'Appointments',
          href: '/doctor/appointments',
          icon: CalendarClock,
          active: pathname.startsWith('/doctor/appointments')
        },
        {
          label: 'Register',
          href: '/doctor/patients/new',
          icon: PlusCircle,
          active: pathname === '/doctor/patients/new'
        }
      ]
    : [
        {
          label: 'Overview',
          href: '/patient/dashboard',
          icon: ActivitySquare,
          active: pathname === '/patient/dashboard'
        },
        {
          label: 'Appointments',
          href: '/patient/appointments',
          icon: CalendarClock,
          active: pathname.startsWith('/patient/appointments')
        },
        {
          label: 'Consultations',
          href: '/patient/consultations',
          icon: FileText,
          active: pathname.startsWith('/patient/consultations')
        }
      ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbf9_0%,#f1f8f5_100%)]">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/78 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f6e56_0%,#20a17d_100%)] text-white shadow-[0_14px_30px_rgba(15,110,86,0.22)]">
                <ActivitySquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                  VirtualCare India
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {isDoctorShell ? 'Doctor workspace' : 'Patient workspace'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex items-center gap-3 text-sm text-muted">
                <div className="text-right">
                  <p className="font-semibold text-ink">{session.user.full_name}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{session.user.role}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearSession();
                    router.push('/login');
                  }}
                >
                  Sign out
                </Button>
              </div>

              <nav className="flex flex-wrap gap-2">
                {navigationItems.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => router.push(item.href)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      item.active
                        ? 'border-[#0f6e56]/15 bg-[linear-gradient(135deg,#0f6e56_0%,#17916f_100%)] text-white shadow-[0_12px_24px_rgba(15,110,86,0.2)]'
                        : 'border-border bg-white/82 text-ink hover:border-[#0f6e56]/25 hover:bg-[#f3fbf7]'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="min-h-[calc(100vh-140px)]">{children}</div>
      </main>
    </div>
  );
}
