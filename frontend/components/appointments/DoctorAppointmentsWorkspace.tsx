'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  CalendarPlus2,
  Clock3,
  FileText,
  MapPin,
  Trash2,
  Video
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Appointment, DoctorAvailabilitySlot } from '@/types';

interface AvailabilityResponse {
  data: DoctorAvailabilitySlot[];
}

interface AppointmentResponse {
  data: Appointment[];
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

function formatCurrency(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(paise / 100);
}

function toIso(localValue: string) {
  if (!localValue) return '';
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function toLocalInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function createDefaultStartValue() {
  const base = new Date();
  base.setHours(base.getHours() + 2, 0, 0, 0);
  return toLocalInputValue(base);
}

function createDefaultEndValue() {
  const base = new Date();
  base.setHours(base.getHours() + 2, 30, 0, 0);
  return toLocalInputValue(base);
}

export default function DoctorAppointmentsWorkspace() {
  const router = useRouter();
  const [availability, setAvailability] = React.useState<DoctorAvailabilitySlot[]>([]);
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    start: createDefaultStartValue(),
    end: createDefaultEndValue(),
    mode: 'video',
    notes: ''
  });

  const loadWorkspace = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [availabilityResponse, appointmentResponse] = await Promise.all([
        api.get<AvailabilityResponse>('/appointments/availability'),
        api.get<AppointmentResponse>('/appointments')
      ]);
      setAvailability(availabilityResponse.data);
      setAppointments(appointmentResponse.data);
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to load appointments workspace');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const upcomingAppointments = appointments.filter(
    (appointment) =>
      appointment.status === 'booked' &&
      appointment.availability &&
      new Date(appointment.availability.end_at).getTime() >= Date.now()
  );

  const availableSlots = availability.filter((slot) => slot.status === 'available');
  const bookedSlots = availability.filter((slot) => slot.status === 'booked');
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' });

  async function handleCreateAvailability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);

    const startIso = toIso(form.start);
    const endIso = toIso(form.end);
    if (!startIso || !endIso) {
      setFormError('Enter a valid date and time range.');
      setSaving(false);
      return;
    }

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setFormError('End time must be after start time.');
      setSaving(false);
      return;
    }

    try {
      await api.post('/appointments/availability', {
        start_at: startIso,
        end_at: endIso,
        mode: form.mode,
        notes: form.notes
      });
      setForm({
        start: createDefaultStartValue(),
        end: createDefaultEndValue(),
        mode: 'video',
        notes: ''
      });
      await loadWorkspace();
    } catch (err: any) {
      setFormError(err?.error?.message ?? 'Unable to create availability');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSlot(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await api.delete(`/appointments/availability/${id}`);
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to remove availability slot');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCancelAppointment(id: string) {
    setCancellingId(id);
    setError(null);
    try {
      await api.patch(`/appointments/${id}/cancel`, { reason: 'Cancelled by doctor' });
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to cancel appointment');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[#d4e6dd] bg-[linear-gradient(135deg,#ffffff_0%,#eef8f3_55%,#f6fbf8_100%)] p-6 shadow-[0_24px_70px_rgba(11,31,26,0.08)] md:p-8">
        <div className="absolute inset-y-0 right-0 w-[36%] bg-[radial-gradient(circle_at_center,rgba(15,110,86,0.12),transparent_58%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dcece4] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary shadow-sm">
              <CalendarClock className="h-3.5 w-3.5" />
              Appointment Command
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              Control your clinic hours and keep bookings flowing cleanly.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted md:text-[15px]">
              Publish open slots, monitor booked visits, and remove unused blocks before patients
              see them. Patients only get slots that are still unclaimed.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Open slots</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{availableSlots.length}</p>
                <p className="mt-2 text-sm text-muted">Future blocks patients can still book.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#0f6e56] p-4 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Booked</p>
                <p className="mt-3 text-3xl font-semibold">{upcomingAppointments.length}</p>
                <p className="mt-2 text-sm text-white/80">Upcoming confirmed visits in your queue.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#fff6ef] p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a85b1b]">Today</p>
                <p className="mt-3 text-xl font-semibold text-[#6b3510]">{todayLabel}</p>
                <p className="mt-2 text-sm text-[#8a5d3d]">Use the studio to open or adjust consultation hours.</p>
              </div>
            </div>
          </div>

          <Card className="rounded-[28px] border-[#d6e7df] bg-white/92 shadow-[0_14px_40px_rgba(11,31,26,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f6e56_0%,#1e8f70_100%)] text-white">
                <CalendarPlus2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Availability studio</p>
                <h2 className="mt-1 text-xl font-semibold text-ink">Publish a new slot</h2>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCreateAvailability}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Start
                  </label>
                  <Input
                    type="datetime-local"
                    value={form.start}
                    onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    End
                  </label>
                  <Input
                    type="datetime-local"
                    value={form.end}
                    onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Mode
                  </label>
                  <select
                    className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm text-ink outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    value={form.mode}
                    onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value }))}
                  >
                    <option value="video">Video</option>
                    <option value="in_person">In person</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Notes
                  </label>
                  <textarea
                    className="min-h-[88px] w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Optional note visible in your schedule."
                  />
                </div>
              </div>

              {formError ? <p className="text-sm font-medium text-danger">{formError}</p> : null}

              <Button type="submit" isLoading={saving}>
                Publish slot
              </Button>
            </form>
          </Card>
        </div>
      </section>

      {error ? (
        <Card className="border-danger/30 bg-[#fff5f5]">
          <p className="text-sm font-semibold text-danger">{error}</p>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f3fbf7_100%)] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Availability agenda</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Upcoming time blocks</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="px-6 py-5">
                  <div className="h-4 w-40 animate-pulse rounded bg-[#e8f1ed]" />
                  <div className="mt-3 h-3 w-56 animate-pulse rounded bg-[#eef5f2]" />
                </div>
              ))
            ) : availability.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted">
                No availability published yet. Create your first slot in the availability studio.
              </div>
            ) : (
              availability.map((slot) => (
                <div key={slot.id} className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{formatDayLabel(slot.start_at)}</p>
                      <span className="rounded-full bg-[#eef6f2] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                        {slot.mode === 'video' ? 'Video' : 'In person'}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                          slot.status === 'booked'
                            ? 'bg-[#fff2e8] text-[#a85b1b]'
                            : slot.status === 'completed'
                              ? 'bg-[#eaf2ff] text-info'
                              : 'bg-[#e6f7f0] text-primary'
                        }`}
                      >
                        {slot.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-4 w-4" />
                        {formatDateTime(slot.start_at)} to {new Date(slot.end_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {slot.notes ? <span>{slot.notes}</span> : null}
                    </div>
                    {slot.appointment?.patient ? (
                      <div className="mt-3 space-y-1">
                        <p className="text-sm font-medium text-ink">
                          Reserved by {slot.appointment.patient.full_name}
                          {slot.appointment.patient.mobile ? ` • ${slot.appointment.patient.mobile}` : ''}
                        </p>
                        {appointments.find((item) => item.id === slot.appointment?.id)?.payment ? (
                          <p className="text-sm text-primary">
                            Payment received:{' '}
                            {formatCurrency(appointments.find((item) => item.id === slot.appointment?.id)?.payment?.amount || 0)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-3">
                    {slot.status === 'available' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        isLoading={deletingId === slot.id}
                        onClick={() => handleDeleteSlot(slot.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!slot.appointment?.patient?.id || !slot.appointment?.id) return;
                          router.push(
                            `/doctor/patients/${slot.appointment.patient.id}?tab=consultations&appointment=${slot.appointment.id}`
                          );
                        }}
                      >
                        <FileText className="h-4 w-4" />
                        Open note
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#fff8f1_100%)] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Booked queue</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Upcoming patient visits</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="px-6 py-5">
                  <div className="h-4 w-36 animate-pulse rounded bg-[#e8f1ed]" />
                  <div className="mt-3 h-3 w-56 animate-pulse rounded bg-[#eef5f2]" />
                </div>
              ))
            ) : upcomingAppointments.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted">
                No confirmed appointments yet. Once patients book your slots, they will appear here.
              </div>
            ) : (
              upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-ink">{appointment.patient?.full_name || 'Patient'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-4 w-4" />
                          {appointment.availability ? formatDateTime(appointment.availability.start_at) : 'Schedule pending'}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          {appointment.availability?.mode === 'video' ? (
                            <Video className="h-4 w-4" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                          {appointment.availability?.mode === 'video' ? 'Video visit' : 'In-person visit'}
                        </span>
                      </div>
                      {appointment.reason ? (
                        <p className="mt-3 text-sm text-ink/80">Reason: {appointment.reason}</p>
                      ) : null}
                      {appointment.payment ? (
                        <p className="mt-2 text-sm text-primary">
                          Payment received: {formatCurrency(appointment.payment.amount)} via {appointment.payment.method}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {appointment.availability?.mode === 'video' ? (
                        <Button
                          type="button"
                          onClick={() =>
                            window.open(
                              `/doctor/appointments/${appointment.id}/visit`,
                              '_blank',
                              'noopener,noreferrer'
                            )
                          }
                        >
                          <Video className="h-4 w-4" />
                          Join visit
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!appointment.patient?.id) return;
                          router.push(
                            `/doctor/patients/${appointment.patient.id}?tab=consultations&appointment=${appointment.id}`
                          );
                        }}
                      >
                        <FileText className="h-4 w-4" />
                        Consultation
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        isLoading={cancellingId === appointment.id}
                        onClick={() => handleCancelAppointment(appointment.id)}
                      >
                        Cancel
                      </Button>
                    </div>
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
