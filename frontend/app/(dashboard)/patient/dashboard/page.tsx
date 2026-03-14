'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Sparkles,
  Stethoscope,
  Video
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Appointment, AppointmentCatalogDoctor, Consultation } from '@/types';

interface AppointmentResponse {
  data: Appointment[];
}

interface CatalogResponse {
  data: AppointmentCatalogDoctor[];
}

interface ConsultationResponse {
  data: Consultation[];
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDayLabel(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  });
}

export default function PatientDashboardPage() {
  const router = useRouter();
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [catalog, setCatalog] = React.useState<AppointmentCatalogDoctor[]>([]);
  const [consultations, setConsultations] = React.useState<Consultation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
        setError(null);
      try {
        const [appointmentResponse, catalogResponse, consultationResponse] = await Promise.all([
          api.get<AppointmentResponse>('/appointments'),
          api.get<CatalogResponse>('/appointments/catalog'),
          api.get<ConsultationResponse>('/consultations')
        ]);
        if (mounted) {
          setAppointments(appointmentResponse.data);
          setCatalog(catalogResponse.data);
          setConsultations(consultationResponse.data);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.error?.message ?? 'Unable to load appointments overview');
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

  const upcomingAppointments = appointments.filter(
    (appointment) =>
      appointment.status === 'booked' &&
      appointment.availability &&
      new Date(appointment.availability.end_at).getTime() >= Date.now()
  );
  const nextAppointment = upcomingAppointments[0] || null;
  const availableSlotCount = catalog.reduce((sum, doctor) => sum + doctor.slots.length, 0);
  const finalizedConsultations = consultations.filter((consultation) => consultation.status === 'finalized').length;
  const nextDoctorWithSlot = catalog.find((doctor) => doctor.slots[0]) || null;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[#d7e4f2] bg-[linear-gradient(135deg,#ffffff_0%,#f3f9ff_46%,#f8fbff_100%)] p-6 shadow-[0_24px_70px_rgba(11,31,26,0.08)] md:p-8">
        <div className="absolute inset-y-0 right-0 w-[40%] bg-[radial-gradient(circle_at_center,rgba(30,93,176,0.14),transparent_58%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d9e8f8] bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-info shadow-sm">
              <CalendarClock className="h-3.5 w-3.5" />
              Patient Care Desk
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              Plan visits, track follow-ups, and stay ready for the next consult.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted md:text-[15px]">
              Your patient workspace now centers on what matters: the next appointment, active doctor availability,
              and consultation notes already ready for review.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => router.push('/patient/appointments')}>
                <CalendarClock className="h-4 w-4" />
                Open appointments
              </Button>
              <Button variant="outline" size="lg" onClick={() => router.push('/patient/consultations')}>
                <FileText className="h-4 w-4" />
                Consultation history
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Upcoming visits</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{upcomingAppointments.length}</p>
                <p className="mt-2 text-sm text-muted">Appointments currently reserved for you.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#1e5db0] p-4 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Open slots</p>
                <p className="mt-3 text-3xl font-semibold">{availableSlotCount}</p>
                <p className="mt-2 text-sm text-white/80">Doctor timings still open for instant booking.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#edf6ff] p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#295386]">Ready notes</p>
                <p className="mt-3 text-3xl font-semibold text-[#16385e]">{finalizedConsultations}</p>
                <p className="mt-2 text-sm text-[#496b93]">Consultation summaries already shared with you.</p>
              </div>
            </div>
          </div>

          <Card className="rounded-[28px] border-[#dbe7f6] bg-white/92 shadow-[0_14px_40px_rgba(11,31,26,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Next action</p>
            {nextAppointment ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-[28px] border border-[#dce8f6] bg-[linear-gradient(135deg,#f7fbff_0%,#ffffff_100%)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-info">Next appointment</p>
                      <h2 className="mt-2 text-2xl font-semibold text-ink">{nextAppointment.doctor?.full_name}</h2>
                    </div>
                    <span className="rounded-full bg-[#eef9f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                      {nextAppointment.availability?.mode === 'video' ? 'Video visit' : 'Clinic visit'}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl bg-[#f7fbff] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Scheduled for</p>
                      <p className="mt-2 text-sm font-semibold text-ink">
                        {nextAppointment.availability ? formatDateTime(nextAppointment.availability.start_at) : 'Pending'}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-[#fff8f1] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a85b1b]">Reason</p>
                      <p className="mt-2 text-sm font-semibold text-[#6b3510]">
                        {nextAppointment.reason || 'General follow-up consultation'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button onClick={() => router.push('/patient/appointments')}>
                      <ArrowRight className="h-4 w-4" />
                      Manage this visit
                    </Button>
                    <Button variant="outline" onClick={() => router.push('/patient/consultations')}>
                      <FileText className="h-4 w-4" />
                      Open consultation history
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[28px] border border-[#dce8f6] bg-[linear-gradient(135deg,#f7fbff_0%,#ffffff_100%)] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1e5db0_0%,#3c76c4_100%)] text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-ink">No active appointment right now</h2>
                    <p className="mt-1 text-sm text-muted">Choose from the latest doctor timings and lock your next consultation.</p>
                  </div>
                </div>
                <div className="mt-5">
                  <Button onClick={() => router.push('/patient/appointments')}>
                    <ArrowRight className="h-4 w-4" />
                    Browse doctor timings
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </section>

      {error ? (
        <Card className="border-danger/30 bg-[#fff5f5]">
          <p className="text-sm font-semibold text-danger">{error}</p>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f3f9ff_100%)] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Visit lane</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Scheduled appointments</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="px-6 py-5">
                  <div className="h-4 w-40 animate-pulse rounded bg-[#e8f1ed]" />
                  <div className="mt-3 h-3 w-56 animate-pulse rounded bg-[#eef5f2]" />
                </div>
              ))
            ) : upcomingAppointments.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted">
                No upcoming appointments yet. Open the appointments page to book one.
              </div>
            ) : (
              upcomingAppointments.slice(0, 3).map((appointment) => (
                <div key={appointment.id} className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-ink">{appointment.doctor?.full_name || 'Doctor'}</p>
                      {appointment.availability ? (
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4" />
                            {formatDateTime(appointment.availability.start_at)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            {appointment.availability.mode === 'video' ? (
                              <Video className="h-4 w-4" />
                            ) : (
                              <Stethoscope className="h-4 w-4" />
                            )}
                            {appointment.availability.mode === 'video' ? 'Video visit' : 'Clinic visit'}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/patient/appointments')}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-semibold text-ink transition hover:bg-[#f7fbff]"
                    >
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#eef9f3_100%)] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Access queue</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Next available clinicians</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="px-6 py-5">
                  <div className="h-4 w-40 animate-pulse rounded bg-[#e8f1ed]" />
                  <div className="mt-3 h-3 w-52 animate-pulse rounded bg-[#eef5f2]" />
                </div>
              ))
            ) : catalog.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted">
                No doctors have published future timings yet.
              </div>
            ) : (
              catalog.slice(0, 3).map((doctor) => (
                <div key={doctor.id} className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-ink">{doctor.full_name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-4 w-4" />
                          {doctor.slots[0] ? formatDateTime(doctor.slots[0].start_at) : 'No slot published'}
                        </span>
                        {doctor.slots[0] ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            {formatDayLabel(doctor.slots[0].start_at)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/patient/appointments')}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-semibold text-ink transition hover:bg-[#f2faf6]"
                    >
                      Book
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
