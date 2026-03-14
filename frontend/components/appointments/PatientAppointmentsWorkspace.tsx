'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  CalendarDays,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Video
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type {
  Appointment,
  AppointmentAvailability,
  AppointmentCatalogDoctor,
  PaymentMethod
} from '@/types';

interface AppointmentResponse {
  data: Appointment[];
}

interface CatalogResponse {
  data: AppointmentCatalogDoctor[];
}

interface CheckoutState {
  doctorId: string;
  doctorName: string;
  slot: AppointmentAvailability;
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

function getSlotAmount(slot: AppointmentAvailability) {
  return slot.mode === 'in_person' ? 79900 : 49900;
}

export default function PatientAppointmentsWorkspace() {
  const router = useRouter();
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [catalog, setCatalog] = React.useState<AppointmentCatalogDoctor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [bookingReason, setBookingReason] = React.useState<Record<string, string>>({});
  const [bookingSlotId, setBookingSlotId] = React.useState<string | null>(null);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [checkout, setCheckout] = React.useState<CheckoutState | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('upi');
  const [paymentNote, setPaymentNote] = React.useState('');

  const loadWorkspace = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointmentResponse, catalogResponse] = await Promise.all([
        api.get<AppointmentResponse>('/appointments'),
        api.get<CatalogResponse>('/appointments/catalog')
      ]);
      setAppointments(appointmentResponse.data);
      setCatalog(catalogResponse.data);
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to load appointments');
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

  const availableSlotCount = catalog.reduce((sum, doctor) => sum + doctor.slots.length, 0);
  const paidAppointments = appointments.filter((appointment) => appointment.payment?.status === 'paid').length;

  async function handleCheckout() {
    if (!checkout) return;

    setBookingSlotId(checkout.slot.id);
    setError(null);

    try {
      await api.post('/payments/checkout', {
        availability_id: checkout.slot.id,
        reason: bookingReason[checkout.doctorId] || '',
        method: paymentMethod,
        amount: getSlotAmount(checkout.slot),
        notes: paymentNote
      });
      setBookingReason((current) => ({ ...current, [checkout.doctorId]: '' }));
      setCheckout(null);
      setPaymentMethod('upi');
      setPaymentNote('');
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to complete payment and book appointment');
    } finally {
      setBookingSlotId(null);
    }
  }

  async function handleCancel(appointmentId: string) {
    setCancellingId(appointmentId);
    setError(null);
    try {
      await api.patch(`/appointments/${appointmentId}/cancel`, { reason: 'Cancelled by patient' });
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to cancel appointment');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[#d7e4f2] bg-[linear-gradient(135deg,#ffffff_0%,#f3f9ff_46%,#f8fbff_100%)] p-6 shadow-[0_24px_70px_rgba(11,31,26,0.08)] md:p-8">
        <div className="absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_center,rgba(30,93,176,0.12),transparent_58%)]" />
        <div className="relative">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d9e8f8] bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-info shadow-sm">
              <CalendarClock className="h-3.5 w-3.5" />
              Appointment Booking
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              Pay once, then lock the meeting instantly.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted md:text-[15px]">
              This billing flow is mocked for now. A successful payment action records the transaction
              and books the doctor slot in one step.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              <div className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Upcoming</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{upcomingAppointments.length}</p>
                <p className="mt-2 text-sm text-muted">Appointments already locked into your schedule.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#1e5db0] p-4 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Open slots</p>
                <p className="mt-3 text-3xl font-semibold">{availableSlotCount}</p>
                <p className="mt-2 text-sm text-white/80">Live bookable timings across available doctors.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#eef5ff] p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#295386]">Doctors</p>
                <p className="mt-3 text-3xl font-semibold text-[#16385e]">{catalog.length}</p>
                <p className="mt-2 text-sm text-[#496b93]">Clinicians currently publishing future timings.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#eef9f3] p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Paid</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{paidAppointments}</p>
                <p className="mt-2 text-sm text-muted">Appointments with successful mock payment.</p>
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

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f3f9ff_100%)] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Book a visit</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Doctors with available timings</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="px-6 py-5">
                  <div className="h-4 w-44 animate-pulse rounded bg-[#e8f1ed]" />
                  <div className="mt-3 h-3 w-60 animate-pulse rounded bg-[#eef5f2]" />
                </div>
              ))
            ) : catalog.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted">
                No open doctor timings right now. Check back after a doctor publishes availability.
              </div>
            ) : (
              catalog.map((doctor) => (
                <div key={doctor.id} className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#e7f0ff_0%,#d6e9ff_100%)] text-info">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-ink">{doctor.full_name}</p>
                      <p className="text-sm text-muted">{doctor.slots.length} open slot(s)</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      Booking note
                    </label>
                    <textarea
                      className="min-h-[76px] w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
                      value={bookingReason[doctor.id] || ''}
                      onChange={(event) =>
                        setBookingReason((current) => ({ ...current, [doctor.id]: event.target.value }))
                      }
                      placeholder="Optional reason for the visit."
                    />
                  </div>

                  <div className="mt-4 grid gap-3">
                    {doctor.slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="rounded-2xl border border-[#e3ebf5] bg-[#fbfdff] px-4 py-4"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-ink">{formatDayLabel(slot.start_at)}</p>
                              <span className="rounded-full bg-[#eaf2ff] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-info">
                                {slot.mode === 'video' ? 'Video' : 'In person'}
                              </span>
                              <span className="rounded-full bg-[#eef9f3] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                                {formatCurrency(getSlotAmount(slot))}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock3 className="h-4 w-4" />
                                {formatDateTime(slot.start_at)}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                {slot.mode === 'video' ? (
                                  <Video className="h-4 w-4" />
                                ) : (
                                  <MapPin className="h-4 w-4" />
                                )}
                                {slot.mode === 'video' ? 'Video consultation' : 'Clinic visit'}
                              </span>
                            </div>
                            {slot.notes ? <p className="mt-3 text-sm text-ink/80">{slot.notes}</p> : null}
                          </div>
                          <Button
                            type="button"
                            isLoading={bookingSlotId === slot.id}
                            onClick={() => {
                              setCheckout({
                                doctorId: doctor.id,
                                doctorName: doctor.full_name,
                                slot
                              });
                              setPaymentMethod('upi');
                              setPaymentNote('');
                            }}
                          >
                            Pay & book
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#fff7ee_100%)] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">My schedule</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Upcoming appointments</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="px-6 py-5">
                  <div className="h-4 w-44 animate-pulse rounded bg-[#e8f1ed]" />
                  <div className="mt-3 h-3 w-56 animate-pulse rounded bg-[#eef5f2]" />
                </div>
              ))
            ) : appointments.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted">
                You do not have any appointments yet. Choose a doctor and claim an open slot.
              </div>
            ) : (
              appointments.map((appointment) => (
                <div key={appointment.id} className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-ink">
                        {appointment.doctor?.full_name || 'Doctor'}
                      </p>
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
                              <MapPin className="h-4 w-4" />
                            )}
                            {appointment.availability.mode === 'video' ? 'Video visit' : 'In-person visit'}
                          </span>
                        </div>
                      ) : null}
                      {appointment.reason ? (
                        <p className="mt-3 text-sm text-ink/80">Reason: {appointment.reason}</p>
                      ) : null}
                      {appointment.payment ? (
                        <p className="mt-2 text-sm text-primary">
                          Payment: {formatCurrency(appointment.payment.amount)} via {appointment.payment.method}
                        </p>
                      ) : null}
                      {appointment.status === 'cancelled' && appointment.cancellation_reason ? (
                        <p className="mt-2 text-sm text-danger">
                          Cancelled: {appointment.cancellation_reason}
                        </p>
                      ) : null}
                    </div>

                    {appointment.status === 'booked' ? (
                      <div className="flex flex-wrap gap-3">
                        {appointment.availability?.mode === 'video' ? (
                          <Button
                            type="button"
                            onClick={() =>
                              window.open(
                                `/patient/appointments/${appointment.id}/visit`,
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
                          onClick={() => router.push(`/patient/consultations?appointment=${appointment.id}`)}
                        >
                          <FileText className="h-4 w-4" />
                          Consultation
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          isLoading={cancellingId === appointment.id}
                          onClick={() => handleCancel(appointment.id)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-full bg-[#fff2e8] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#a85b1b]">
                        {appointment.status}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      {checkout ? (
        <Card className="border-[#dbe7f6] bg-[linear-gradient(135deg,#ffffff_0%,#f5fbff_100%)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#eaf2ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-info">
                <CreditCard className="h-3.5 w-3.5" />
                Billing Checkout
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-ink">Confirm payment and book the meet</h3>
              <p className="mt-3 text-sm leading-6 text-muted">
                This is a simulated billing step. Once you click the payment button, the system records
                a successful payment and books the meeting with the doctor immediately.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-[#dce8f6] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Doctor</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{checkout.doctorName}</p>
                </div>
                <div className="rounded-3xl border border-[#dce8f6] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Slot</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{formatDateTime(checkout.slot.start_at)}</p>
                </div>
                <div className="rounded-3xl border border-[#dce8f6] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Amount</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(getSlotAmount(checkout.slot))}</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-xl rounded-[28px] border border-[#dce8f6] bg-white p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { value: 'upi', label: 'UPI' },
                  { value: 'card', label: 'Card' },
                  { value: 'cash', label: 'Cash' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPaymentMethod(option.value as PaymentMethod)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      paymentMethod === option.value
                        ? 'border-info bg-[#edf5ff] text-info'
                        : 'border-border bg-white text-ink hover:bg-[#f8fbff]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-[#f7fbff] px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Mock payment succeeds instantly
                </div>
                <p className="mt-2 text-sm text-muted">
                  No real gateway is integrated here. This only creates a payment record and books the appointment.
                </p>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Billing note
                </label>
                <textarea
                  className="min-h-[88px] w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                  placeholder="Optional payment note or reference."
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  type="button"
                  isLoading={bookingSlotId === checkout.slot.id}
                  onClick={handleCheckout}
                >
                  Pay {formatCurrency(getSlotAmount(checkout.slot))} & book
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={bookingSlotId === checkout.slot.id}
                  onClick={() => setCheckout(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
