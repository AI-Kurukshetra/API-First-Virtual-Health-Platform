'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  ClipboardPlus,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  UsersRound
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Patient } from '@/types';

interface PatientListResponse {
  data: Patient[];
  meta: { limit: number; cursor: number; total: number };
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getAge(dateOfBirth: string) {
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function formatDateLabel(value?: string) {
  if (!value) return 'Recently';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently';
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function DoctorDashboardPage() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<PatientListResponse>('/patients?limit=50');
        if (mounted) {
          setPatients(response.data);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.error?.message ?? 'Unable to load dashboard');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const totalPatients = patients.length;
  const aiConsentCount = patients.filter((patient) => patient.ai_consent).length;
  const aiConsentRate = totalPatients ? Math.round((aiConsentCount / totalPatients) * 100) : 0;
  const withAbha = patients.filter((patient) => patient.abha_id).length;
  const withCompleteProfile = patients.filter(
    (patient) => patient.email && patient.address?.city && patient.address?.line1
  ).length;
  const recordsNeedingAttention = patients.filter(
    (patient) => !patient.email || !patient.address?.city || !patient.address?.line1
  ).length;
  const recentPatients = [...patients]
    .sort((left, right) => {
      const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
      const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 5);
  const lastSevenDays = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = patients.filter((patient) => {
    if (!patient.created_at) return false;
    const createdTime = new Date(patient.created_at).getTime();
    return !Number.isNaN(createdTime) && createdTime >= lastSevenDays;
  }).length;

  const ages = patients
    .map((patient) => getAge(patient.date_of_birth))
    .filter((value): value is number => value !== null);
  const averageAge = ages.length
    ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length)
    : 0;

  const femalePatients = patients.filter((patient) => patient.gender === 'female').length;
  const malePatients = patients.filter((patient) => patient.gender === 'male').length;
  const otherPatients = patients.filter(
    (patient) => patient.gender !== 'female' && patient.gender !== 'male'
  ).length;

  const bloodGroupDistribution = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => ({
    group,
    count: patients.filter((patient) => patient.blood_group === group).length
  }));
  const topBloodGroups = bloodGroupDistribution
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);

  const focusItems = [
    {
      label: 'AI consent coverage',
      value: `${aiConsentRate}%`,
      tone: 'from-[#0f6e56] to-[#18936e]',
      width: `${aiConsentRate}%`
    },
    {
      label: 'ABHA linked profiles',
      value: `${withAbha}/${totalPatients || 0}`,
      tone: 'from-[#0d5a93] to-[#1d80c3]',
      width: `${totalPatients ? Math.round((withAbha / totalPatients) * 100) : 0}%`
    },
    {
      label: 'Profile completeness',
      value: `${totalPatients ? Math.round((withCompleteProfile / totalPatients) * 100) : 0}%`,
      tone: 'from-[#e37a2e] to-[#f09a59]',
      width: `${totalPatients ? Math.round((withCompleteProfile / totalPatients) * 100) : 0}%`
    }
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[#cfe2d8] bg-[#f4fbf8] p-6 shadow-[0_24px_80px_rgba(11,31,26,0.08)] md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,110,86,0.2),transparent_36%),radial-gradient(circle_at_85%_20%,rgba(227,122,46,0.16),transparent_28%),linear-gradient(135deg,#ffffff_0%,#eef8f3_42%,#f7fbf9_100%)]" />
        <div className="absolute -right-12 top-10 h-36 w-36 rounded-full border border-white/60 bg-white/40 blur-2xl" />
        <div className="absolute bottom-0 right-20 h-28 w-28 rounded-full bg-[#dff6ee] blur-2xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary shadow-sm">
              <Stethoscope className="h-3.5 w-3.5" />
              Doctor Command Center
            </div>
            <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight text-ink md:text-4xl">
              {getGreeting()}
              {session?.user?.full_name ? `, ${session.user.full_name}` : ''}. Your clinic pulse is live.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted md:text-[15px]">
              Track patient volume, data readiness, and follow-up priorities from one surface.
              This dashboard is built from the live patient registry, not placeholder content.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => router.push('/doctor/patients/new')}>
                <ClipboardPlus className="h-4 w-4" />
                Register patient
              </Button>
              <Button variant="secondary" size="lg" onClick={() => router.push('/doctor/appointments')}>
                <CalendarClock className="h-4 w-4" />
                Manage appointments
              </Button>
              <Button variant="outline" size="lg" onClick={() => router.push('/doctor/patients')}>
                <UsersRound className="h-4 w-4" />
                Open patient registry
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Total roster
                </p>
                <p className="mt-3 text-3xl font-semibold text-ink">{totalPatients}</p>
                <p className="mt-2 text-sm text-muted">Patients currently visible to this doctor.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#0f6e56] p-4 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  AI ready
                </p>
                <p className="mt-3 text-3xl font-semibold">{aiConsentRate}%</p>
                <p className="mt-2 text-sm text-white/80">{aiConsentCount} profiles have consent on file.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#fff6ef] p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a85b1b]">
                  New this week
                </p>
                <p className="mt-3 text-3xl font-semibold text-[#6b3510]">{newThisWeek}</p>
                <p className="mt-2 text-sm text-[#8a5d3d]">Fresh registrations added in the last 7 days.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#d7e8df] bg-[#0d1d19] p-5 text-white shadow-[0_20px_50px_rgba(11,31,26,0.25)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
                  Shift Snapshot
                </p>
                <p className="mt-2 text-2xl font-semibold">Care operations</p>
              </div>
              <HeartPulse className="h-5 w-5 text-[#8ce0bf]" />
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-white/6 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/65">Average patient age</span>
                  <span className="font-semibold text-white">{averageAge || 'NA'}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-[#8ce0bf] to-[#d7fff0]"
                    style={{ width: `${Math.min(averageAge, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white/6 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/45">Female</p>
                  <p className="mt-2 text-2xl font-semibold">{femalePatients}</p>
                </div>
                <div className="rounded-2xl bg-white/6 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/45">Male</p>
                  <p className="mt-2 text-2xl font-semibold">{malePatients}</p>
                </div>
                <div className="rounded-2xl bg-white/6 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/45">Other</p>
                  <p className="mt-2 text-2xl font-semibold">{otherPatients}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/70">Records needing cleanup</p>
                  <ShieldCheck className="h-4 w-4 text-[#ffc88e]" />
                </div>
                <p className="mt-3 text-3xl font-semibold">{recordsNeedingAttention}</p>
                <p className="mt-2 text-sm text-white/60">
                  Missing email or address details that may slow downstream workflows.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <Card className="border-danger/30 bg-[#fff5f5]">
          <p className="text-sm font-semibold text-danger">{error}</p>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Patient roster',
            value: totalPatients,
            note: 'Live patient records in your clinic scope.',
            icon: UsersRound,
            accent: 'from-[#0f6e56] to-[#17916f]'
          },
          {
            label: 'AI-consented',
            value: aiConsentCount,
            note: 'Profiles ready for AI-assisted note workflows.',
            icon: BrainCircuit,
            accent: 'from-[#0d5a93] to-[#1f80bf]'
          },
          {
            label: 'ABHA linked',
            value: withAbha,
            note: 'Patients with health ID already attached.',
            icon: ShieldCheck,
            accent: 'from-[#c66c25] to-[#ea914c]'
          },
          {
            label: 'New this week',
            value: newThisWeek,
            note: 'Recent registrations from the last 7 days.',
            icon: Activity,
            accent: 'from-[#9b2c2c] to-[#d96b6b]'
          }
        ].map((item) => (
          <div
            key={item.label}
            className="group relative overflow-hidden rounded-[28px] border border-border bg-white p-5 shadow-[0_18px_45px_rgba(11,31,26,0.07)] transition hover:-translate-y-1"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.accent}`} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-ink">{item.value}</p>
              </div>
              <div className={`rounded-2xl bg-gradient-to-br p-3 text-white shadow-sm ${item.accent}`}>
                <item.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">{item.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f3fbf7_100%)] px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Recent Registry Activity
                </p>
                <h2 className="mt-2 text-xl font-semibold text-ink">Latest patient additions</h2>
              </div>
              <Button variant="ghost" type="button" onClick={() => router.push('/doctor/patients')}>
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 px-6 py-5">
                  <div className="h-11 w-11 animate-pulse rounded-2xl bg-[#e8f1ed]" />
                  <div className="flex-1">
                    <div className="h-4 w-40 animate-pulse rounded bg-[#eef5f2]" />
                    <div className="mt-3 h-3 w-60 animate-pulse rounded bg-[#eef5f2]" />
                  </div>
                </div>
              ))
            ) : recentPatients.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted">
                No patients available yet. Add your first patient to activate the dashboard.
              </div>
            ) : (
              recentPatients.map((patient, index) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => router.push(`/doctor/patients/${patient.id}`)}
                  className="flex w-full items-center gap-4 px-6 py-5 text-left transition hover:bg-[#f8fcfa]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#e1f5ee_0%,#c8ecdf_100%)] text-sm font-semibold text-primary">
                    {getInitials(patient.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{patient.full_name}</p>
                      <span className="rounded-full bg-[#eef6f2] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                        #{String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {patient.mobile} • {patient.blood_group || 'Blood group pending'} • Added{' '}
                      {formatDateLabel(patient.created_at)}
                    </p>
                  </div>
                  <div className="rounded-full bg-[#0f6e56]/8 px-3 py-1 text-xs font-semibold text-primary">
                    {patient.ai_consent ? 'AI ready' : 'Consent pending'}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Operational Focus
              </p>
              <h2 className="mt-2 text-xl font-semibold text-ink">Registry quality signals</h2>
            </div>
            <div className="space-y-5 px-6 py-6">
              {focusItems.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{item.label}</span>
                    <span className="font-semibold text-muted">{item.value}</span>
                  </div>
                  <div className="mt-3 h-2.5 rounded-full bg-[#ecf3ef]">
                    <div
                      className={`h-2.5 rounded-full bg-gradient-to-r ${item.tone}`}
                      style={{ width: item.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Blood Group Mix
              </p>
              <h2 className="mt-2 text-xl font-semibold text-ink">Top distribution clusters</h2>
            </div>
            <div className="space-y-4 px-6 py-6">
              {topBloodGroups.length === 0 ? (
                <p className="text-sm text-muted">Blood group data will appear here once patient charts are enriched.</p>
              ) : (
                topBloodGroups.map((item) => (
                  <div key={item.group}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{item.group}</span>
                      <span className="text-muted">{item.count} patients</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-[#edf5f1]">
                      <div
                        className="h-2.5 rounded-full bg-[linear-gradient(90deg,#0f6e56_0%,#7bd0b0_100%)]"
                        style={{ width: `${Math.round((item.count / Math.max(totalPatients, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
