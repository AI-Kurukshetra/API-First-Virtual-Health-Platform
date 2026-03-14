'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BrainCircuit,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  UserRoundPlus,
  UsersRound
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Patient } from '@/types';

interface PatientListResponse {
  data: Patient[];
  meta: { limit: number; cursor: number; total: number };
}

function getAge(dateOfBirth: string) {
  const date = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  const dayDiff = today.getDate() - date.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function PatientList() {
  const router = useRouter();
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadPatients = React.useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = query ? `?search=${encodeURIComponent(query)}` : '';
      const response = await api.get<PatientListResponse>(`/patients${params}`);
      setPatients(response.data);
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to load patients');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadPatients('');
  }, [loadPatients]);

  const aiReadyCount = patients.filter((patient) => patient.ai_consent).length;
  const abhaLinkedCount = patients.filter((patient) => patient.abha_id).length;
  const recordsNeedingReview = patients.filter(
    (patient) => !patient.email || !patient.address?.city || !patient.address?.line1
  ).length;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[#d4e6dd] bg-[linear-gradient(135deg,#ffffff_0%,#eef8f3_55%,#f6fbf8_100%)] p-6 shadow-[0_24px_70px_rgba(11,31,26,0.08)] md:p-8">
        <div className="absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_center,rgba(15,110,86,0.12),transparent_58%)]" />
        <div className="absolute -right-8 top-8 h-32 w-32 rounded-full bg-[#dff6ee] blur-2xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dcece4] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary shadow-sm">
              <UsersRound className="h-3.5 w-3.5" />
              Patient Registry
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              Organised charts, fast triage, cleaner follow-through.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted md:text-[15px]">
              Search patients instantly, surface records that need cleanup, and jump into a chart
              without fighting the interface.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => router.push('/doctor/patients/new')}>
                <UserRoundPlus className="h-4 w-4" />
                Add patient
              </Button>
              <Button variant="outline" size="lg" onClick={() => loadPatients(search)}>
                <Search className="h-4 w-4" />
                Refresh registry
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Registry size</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{patients.length}</p>
                <p className="mt-2 text-sm text-muted">Live patient charts currently available.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#0f6e56] p-4 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">AI ready</p>
                <p className="mt-3 text-3xl font-semibold">{aiReadyCount}</p>
                <p className="mt-2 text-sm text-white/80">Patients with AI consent already captured.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#fff6ef] p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a85b1b]">Needs review</p>
                <p className="mt-3 text-3xl font-semibold text-[#6b3510]">{recordsNeedingReview}</p>
                <p className="mt-2 text-sm text-[#8a5d3d]">Profiles missing contact or address depth.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#d6e7df] bg-white/90 p-5 shadow-[0_14px_40px_rgba(11,31,26,0.08)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Search Console
            </p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Find the right chart fast</h2>
            <div className="mt-5 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  className="pl-11"
                  placeholder="Search by name or mobile"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      loadPatients(search);
                    }
                  }}
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" className="flex-1" onClick={() => loadPatients(search)}>
                  Search registry
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearch('');
                    loadPatients('');
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl bg-[#f5fbf8] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">ABHA linked</span>
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-ink">{abhaLinkedCount}</p>
              </div>
              <div className="rounded-2xl bg-[#f8f5ff] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">Consent coverage</span>
                  <BrainCircuit className="h-4 w-4 text-[#7f56d9]" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-ink">
                  {patients.length ? Math.round((aiReadyCount / patients.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse rounded-[28px]">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-2xl bg-[#e8f1ed]" />
                <div className="flex-1">
                  <div className="h-4 w-40 rounded bg-[#e8f1ed]" />
                  <div className="mt-3 h-3 w-48 rounded bg-[#eef5f2]" />
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="h-16 rounded-2xl bg-[#eef5f2]" />
                    <div className="h-16 rounded-2xl bg-[#eef5f2]" />
                    <div className="h-16 rounded-2xl bg-[#eef5f2]" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-danger/30 bg-[#fdf4f4]">
          <p className="text-sm font-semibold text-danger">{error}</p>
        </Card>
      ) : patients.length === 0 ? (
        <Card className="rounded-[28px] border-dashed text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#eef8f3] text-primary">
            <UsersRound className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-ink">No patients found</h2>
          <p className="mt-2 text-sm text-muted">
            Try a broader search or register a new patient to populate the registry.
          </p>
          <div className="mt-6">
            <Button type="button" onClick={() => router.push('/doctor/patients/new')}>
              Add patient
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {patients.map((patient) => (
            <Link key={patient.id} href={`/doctor/patients/${patient.id}`} className="block">
              <Card className="group rounded-[28px] border-[#d6e7df] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdfc_100%)] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#bfdccc] hover:shadow-[0_18px_45px_rgba(11,31,26,0.08)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#e1f5ee_0%,#cdeee2_100%)] text-base font-semibold text-primary">
                      {getInitials(patient.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-ink">{patient.full_name}</p>
                        <span className="rounded-full bg-[#eef6f2] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                          {patient.gender}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {patient.mobile}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {patient.address?.city || 'City pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-full bg-[#0f6e56]/8 px-3 py-1 text-xs font-semibold text-primary">
                    {patient.ai_consent ? 'AI ready' : 'Consent pending'}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#edf4f0] bg-[#f8fcfa] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Age</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{getAge(patient.date_of_birth) ?? 'NA'}</p>
                  </div>
                  <div className="rounded-2xl border border-[#edf4f0] bg-[#f8fcfa] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Blood</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{patient.blood_group || 'Pending'}</p>
                  </div>
                  <div className="rounded-2xl border border-[#edf4f0] bg-[#f8fcfa] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">ABHA</p>
                    <p className="mt-2 truncate text-lg font-semibold text-ink">
                      {patient.abha_id ? 'Linked' : 'Missing'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[#edf4f0] pt-4 text-sm">
                  <div className="text-muted">{patient.email || 'Email pending'}</div>
                  <div className="inline-flex items-center gap-2 font-semibold text-primary transition group-hover:gap-3">
                    Open chart
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
