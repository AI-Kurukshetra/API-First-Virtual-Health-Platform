'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileClock,
  FileText,
  Stethoscope,
  Video
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Appointment, Consultation, Prescription } from '@/types';

interface AppointmentResponse {
  data: Appointment[];
}

interface ConsultationResponse {
  data: Consultation[];
}

interface PrescriptionResponse {
  data: Prescription[];
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Schedule pending';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Schedule pending';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDayLabel(value?: string | null) {
  if (!value) return 'Pending';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Pending';
  return parsed.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getTimelineTone(consultation: Consultation | null) {
  if (!consultation) {
    return {
      label: 'Awaiting note',
      className: 'bg-[#eef3f8] text-[#4b6580]'
    };
  }

  if (consultation.status === 'finalized') {
    return {
      label: 'Ready to read',
      className: 'bg-[#e6f7f0] text-primary'
    };
  }

  return {
    label: 'Doctor drafting',
    className: 'bg-[#fff3e9] text-[#a85b1b]'
  };
}

export default function PatientConsultationsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedAppointmentId = searchParams.get('appointment');

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [consultations, setConsultations] = React.useState<Consultation[]>([]);
  const [prescriptions, setPrescriptions] = React.useState<Prescription[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const visitTimeline = React.useMemo(
    () =>
      [...appointments]
        .filter((appointment) => appointment.status !== 'cancelled')
        .sort((left, right) => {
          const leftTime = left.availability ? new Date(left.availability.start_at).getTime() : 0;
          const rightTime = right.availability ? new Date(right.availability.start_at).getTime() : 0;
          return rightTime - leftTime;
        }),
    [appointments]
  );

  const consultationMap = React.useMemo(
    () =>
      Object.fromEntries(consultations.map((consultation) => [consultation.appointment_id, consultation])),
    [consultations]
  );

  const selectedAppointment = React.useMemo(
    () =>
      visitTimeline.find((appointment) => appointment.id === selectedAppointmentId) ||
      visitTimeline[0] ||
      null,
    [visitTimeline, selectedAppointmentId]
  );

  const selectedConsultation = selectedAppointment ? consultationMap[selectedAppointment.id] || null : null;
  const prescriptionMap = React.useMemo(
    () =>
      Object.fromEntries(prescriptions.map((prescription) => [prescription.consultation_id, prescription])),
    [prescriptions]
  );
  const selectedPrescription = selectedConsultation ? prescriptionMap[selectedConsultation.id] || null : null;

  const loadWorkspace = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointmentResponse, consultationResponse, prescriptionResponse] = await Promise.all([
        api.get<AppointmentResponse>('/appointments'),
        api.get<ConsultationResponse>('/consultations'),
        api.get<PrescriptionResponse>('/prescriptions')
      ]);
      setAppointments(appointmentResponse.data);
      setConsultations(consultationResponse.data);
      setPrescriptions(prescriptionResponse.data);
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to load consultation history');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  React.useEffect(() => {
    if (!visitTimeline.length) {
      setSelectedAppointmentId(null);
      return;
    }

    if (requestedAppointmentId && visitTimeline.some((appointment) => appointment.id === requestedAppointmentId)) {
      setSelectedAppointmentId(requestedAppointmentId);
      return;
    }

    if (selectedAppointmentId && visitTimeline.some((appointment) => appointment.id === selectedAppointmentId)) {
      return;
    }

    setSelectedAppointmentId(visitTimeline[0].id);
  }, [requestedAppointmentId, selectedAppointmentId, visitTimeline]);

  const finalizedCount = consultations.filter((consultation) => consultation.status === 'finalized').length;
  const prescriptionCount = prescriptions.length;
  const pendingCount = visitTimeline.filter((appointment) => {
    const consultation = consultationMap[appointment.id] || null;
    return !consultation || consultation.status !== 'finalized';
  }).length;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[#d8e5f3] bg-[linear-gradient(135deg,#ffffff_0%,#f4fbff_46%,#f9fdff_100%)] p-6 shadow-[0_24px_70px_rgba(11,31,26,0.08)] md:p-8">
        <div className="absolute inset-y-0 right-0 w-[36%] bg-[radial-gradient(circle_at_center,rgba(30,93,176,0.12),transparent_58%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.14fr_0.86fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dae9f7] bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-info shadow-sm">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Consultation History
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              Read your visit summaries appointment by appointment.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted md:text-[15px]">
              Each visit can have its own consultation note. Once your doctor finalizes the summary,
              it appears here with the visit plan and follow-up guidance.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/92 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">My visits</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{visitTimeline.length}</p>
                <p className="mt-2 text-sm text-muted">Appointments in your active consultation history.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#1e5db0] p-4 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Ready notes</p>
                <p className="mt-3 text-3xl font-semibold">{finalizedCount}</p>
                <p className="mt-2 text-sm text-white/80">Finalized summaries available for review.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#edf6ff] p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#295386]">Prescriptions</p>
                <p className="mt-3 text-3xl font-semibold text-[#16385e]">{prescriptionCount}</p>
                <p className="mt-2 text-sm text-[#496b93]">Visit-wise medication plans already shared.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#fff8ef] p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a85b1b]">Pending</p>
                <p className="mt-3 text-3xl font-semibold text-[#6b3510]">{pendingCount}</p>
                <p className="mt-2 text-sm text-[#8a5d3d]">Visits still waiting for a finalized doctor note.</p>
              </div>
            </div>
          </div>

          <Card className="rounded-[28px] border-[#dce8f6] bg-white/92 shadow-[0_14px_40px_rgba(11,31,26,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">What you can see</p>
            <div className="mt-5 space-y-4">
              {[
                'Appointment-wise consultation summaries',
                'Doctor-approved follow-up plans',
                'Pending status while the doctor finishes the note'
              ].map((item, index) => (
                <div key={item} className="flex gap-4 rounded-2xl bg-[#f6f9ff] px-4 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e5db0] text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm text-ink">{item}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {error ? (
        <Card className="border-danger/30 bg-[#fff5f5]">
          <p className="text-sm font-semibold text-danger">{error}</p>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f3f9ff_100%)] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Timeline</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Visit-wise consultation status</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="px-6 py-5">
                  <div className="h-4 w-40 animate-pulse rounded bg-[#e8eef8]" />
                  <div className="mt-3 h-3 w-56 animate-pulse rounded bg-[#eef4fb]" />
                </div>
              ))
            ) : visitTimeline.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted">
                You do not have any appointments with consultation history yet.
              </div>
            ) : (
              visitTimeline.map((appointment) => {
                const consultation = consultationMap[appointment.id] || null;
                const tone = getTimelineTone(consultation);
                const active = appointment.id === selectedAppointment?.id;

                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => setSelectedAppointmentId(appointment.id)}
                    className={`w-full px-6 py-5 text-left transition ${
                      active ? 'bg-[#f5f9ff]' : 'bg-white hover:bg-[#fafcff]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-ink">
                        {appointment.doctor?.full_name || 'Doctor'}
                      </p>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone.className}`}>
                        {tone.label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />
                        {formatDateTime(appointment.availability?.start_at)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        {appointment.availability?.mode === 'video' ? (
                          <Video className="h-4 w-4" />
                        ) : (
                          <Stethoscope className="h-4 w-4" />
                        )}
                        {appointment.availability?.mode === 'video' ? 'Video visit' : 'Clinic visit'}
                      </span>
                    </div>
                    {appointment.reason ? (
                      <p className="mt-3 text-sm text-ink/80">Reason: {appointment.reason}</p>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Selected visit</p>
                <h2 className="mt-2 text-xl font-semibold text-ink">
                  {selectedAppointment?.doctor?.full_name || 'Select a visit'}
                </h2>
              </div>
              <Button type="button" variant="outline" onClick={() => router.push('/patient/appointments')}>
                Open appointments
              </Button>
            </div>
          </div>

          {!selectedAppointment ? (
            <div className="px-6 py-10 text-sm text-muted">
              Select a visit from the left to review its consultation status.
            </div>
          ) : (
            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-[#e5edf8] bg-[#f8fbff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Visit date</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatDayLabel(selectedAppointment.availability?.start_at)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {formatDateTime(selectedAppointment.availability?.start_at)}
                  </p>
                </div>
                <div className="rounded-3xl border border-[#e5edf8] bg-[#f8fbff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Mode</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {selectedAppointment.availability?.mode === 'video' ? 'Video consultation' : 'Clinic consultation'}
                  </p>
                  <p className="mt-1 text-sm text-muted">{selectedAppointment.reason || 'No visit note provided.'}</p>
                </div>
                <div className="rounded-3xl border border-[#e5edf8] bg-[#f8fbff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Note status</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {!selectedConsultation
                      ? 'Awaiting doctor note'
                      : selectedConsultation.status === 'finalized'
                        ? 'Finalized summary ready'
                        : 'Doctor drafting summary'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {selectedConsultation?.updated_at
                      ? `Last updated ${formatDateTime(selectedConsultation.updated_at)}`
                      : 'Your doctor has not published a consultation summary yet.'}
                  </p>
                </div>
              </div>

              {!selectedConsultation ? (
                <div className="rounded-[28px] border border-dashed border-[#d6e4f2] bg-[#f8fbff] px-5 py-8 text-sm text-muted">
                  This appointment does not have a consultation note yet. It will appear here once your
                  doctor starts documenting the visit.
                </div>
              ) : selectedConsultation.status !== 'finalized' ? (
                <div className="rounded-[28px] border border-[#f1e0cf] bg-[#fff8ef] px-5 py-8">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffe6cf] text-[#a85b1b]">
                      <FileClock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-[#6b3510]">Doctor note in progress</p>
                      <p className="mt-1 text-sm text-[#8a5d3d]">
                        The doctor has started documenting this visit, but the patient-facing summary has not
                        been finalized yet.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-[28px] border border-[#dce9f7] bg-[#f9fcff] p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#e6f0ff_0%,#dceaff_100%)] text-info">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Chief complaint</p>
                        <p className="mt-1 text-base font-semibold text-ink">
                          {selectedConsultation.chief_complaint || 'Visit summary'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-[28px] border border-[#dce9f7] bg-white p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Doctor summary</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">
                        {selectedConsultation.patient_summary || 'No summary shared yet.'}
                      </p>
                    </div>
                    <div className="rounded-[28px] border border-[#dce9f7] bg-white p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Plan and follow-up</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">
                        {selectedConsultation.plan || 'No follow-up plan shared yet.'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-[#dce9f7] bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Prescription</p>
                    {!selectedPrescription ? (
                      <p className="mt-3 text-sm leading-6 text-muted">
                        No medicines were added to this consultation yet.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {selectedPrescription.notes ? (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">
                            {selectedPrescription.notes}
                          </p>
                        ) : null}
                        <div className="grid gap-3">
                          {selectedPrescription.items.map((item) => (
                            <div key={item.id} className="rounded-3xl bg-[#f8fbff] p-4">
                              <p className="text-sm font-semibold text-ink">
                                {item.medicine_name}
                                {item.strength ? ` • ${item.strength}` : ''}
                              </p>
                              <p className="mt-2 text-sm text-muted">
                                {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' • ') || 'Dose details pending'}
                              </p>
                              <p className="mt-1 text-sm text-muted">
                                {[item.route, item.timing].filter(Boolean).join(' • ')}
                              </p>
                              {item.instructions ? (
                                <p className="mt-2 text-sm leading-6 text-ink">{item.instructions}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
