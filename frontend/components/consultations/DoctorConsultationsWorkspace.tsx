'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  ClipboardPenLine,
  FileText,
  Sparkles,
  Stethoscope,
  Video
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Appointment, Consultation, ConsultationStatus } from '@/types';

interface AppointmentResponse {
  data: Appointment[];
}

interface ConsultationResponse {
  data: Consultation[];
}

interface ConsultationPayload {
  appointment_id?: string;
  status?: ConsultationStatus;
  chief_complaint?: string;
  subjective_note?: string;
  objective_note?: string;
  assessment?: string;
  plan?: string;
  patient_summary?: string;
  ai_draft_note?: string;
}

interface ConsultationFormState {
  chief_complaint: string;
  subjective_note: string;
  objective_note: string;
  assessment: string;
  plan: string;
  patient_summary: string;
  ai_draft_note: string;
}

const EMPTY_FORM: ConsultationFormState = {
  chief_complaint: '',
  subjective_note: '',
  objective_note: '',
  assessment: '',
  plan: '',
  patient_summary: '',
  ai_draft_note: ''
};

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
  if (!value) return 'Unscheduled';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unscheduled';
  return parsed.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  });
}

function getInitials(name?: string | null) {
  if (!name) return 'PT';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function buildFormState(consultation: Consultation | null): ConsultationFormState {
  if (!consultation) return EMPTY_FORM;
  return {
    chief_complaint: consultation.chief_complaint || '',
    subjective_note: consultation.subjective_note || '',
    objective_note: consultation.objective_note || '',
    assessment: consultation.assessment || '',
    plan: consultation.plan || '',
    patient_summary: consultation.patient_summary || '',
    ai_draft_note: consultation.ai_draft_note || ''
  };
}

function validateForFinalization(form: ConsultationFormState) {
  const required: Array<keyof ConsultationFormState> = [
    'chief_complaint',
    'assessment',
    'plan',
    'patient_summary'
  ];

  for (const field of required) {
    if (!form[field].trim()) {
      return 'Chief complaint, assessment, plan, and patient summary are required to finalize a consultation.';
    }
  }

  return null;
}

function getConsultationTone(consultation: Consultation | null) {
  if (!consultation) {
    return {
      label: 'Not started',
      className: 'bg-[#eef4f1] text-muted'
    };
  }

  if (consultation.status === 'finalized') {
    return {
      label: 'Finalized',
      className: 'bg-[#e6f7f0] text-primary'
    };
  }

  return {
    label: 'Draft',
    className: 'bg-[#fff3e9] text-[#a85b1b]'
  };
}

export default function DoctorConsultationsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedAppointmentId = searchParams.get('appointment');

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [consultations, setConsultations] = React.useState<Consultation[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<ConsultationFormState>(EMPTY_FORM);
  const [loading, setLoading] = React.useState(true);
  const [savingStatus, setSavingStatus] = React.useState<ConsultationStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const encounterAppointments = React.useMemo(
    () =>
      [...appointments]
        .filter((appointment) => appointment.patient && appointment.status !== 'cancelled')
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
      encounterAppointments.find((appointment) => appointment.id === selectedAppointmentId) ||
      encounterAppointments[0] ||
      null,
    [encounterAppointments, selectedAppointmentId]
  );

  const selectedConsultation = selectedAppointment ? consultationMap[selectedAppointment.id] || null : null;

  const loadWorkspace = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointmentResponse, consultationResponse] = await Promise.all([
        api.get<AppointmentResponse>('/appointments'),
        api.get<ConsultationResponse>('/consultations')
      ]);

      setAppointments(appointmentResponse.data);
      setConsultations(consultationResponse.data);
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to load consultations workspace');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  React.useEffect(() => {
    if (!encounterAppointments.length) {
      setSelectedAppointmentId(null);
      return;
    }

    if (requestedAppointmentId && encounterAppointments.some((appointment) => appointment.id === requestedAppointmentId)) {
      setSelectedAppointmentId(requestedAppointmentId);
      return;
    }

    if (
      selectedAppointmentId &&
      encounterAppointments.some((appointment) => appointment.id === selectedAppointmentId)
    ) {
      return;
    }

    setSelectedAppointmentId(encounterAppointments[0].id);
  }, [encounterAppointments, requestedAppointmentId, selectedAppointmentId]);

  React.useEffect(() => {
    setForm(buildFormState(selectedConsultation));
    setFormError(null);
  }, [selectedConsultation?.id, selectedAppointmentId]);

  const finalizedCount = consultations.filter((consultation) => consultation.status === 'finalized').length;
  const draftCount = consultations.filter((consultation) => consultation.status === 'draft').length;
  const undocumentedCount = Math.max(encounterAppointments.length - consultations.length, 0);

  async function persistConsultation(status: ConsultationStatus) {
    if (!selectedAppointment) {
      setFormError('Select an appointment before creating a consultation note.');
      return;
    }

    if (status === 'finalized') {
      const validationError = validateForFinalization(form);
      if (validationError) {
        setFormError(validationError);
        return;
      }
    }

    setSavingStatus(status);
    setFormError(null);
    setError(null);

    const payload: ConsultationPayload = {
      appointment_id: selectedAppointment.id,
      status,
      chief_complaint: form.chief_complaint,
      subjective_note: form.subjective_note,
      objective_note: form.objective_note,
      assessment: form.assessment,
      plan: form.plan,
      patient_summary: form.patient_summary,
      ai_draft_note: form.ai_draft_note
    };

    try {
      if (selectedConsultation) {
        await api.patch(`/consultations/${selectedConsultation.id}`, payload);
      } else {
        await api.post('/consultations', payload);
      }

      await loadWorkspace();
    } catch (err: any) {
      setFormError(err?.error?.message ?? 'Unable to save consultation note');
    } finally {
      setSavingStatus(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[#d8e2f4] bg-[linear-gradient(135deg,#ffffff_0%,#f6f8ff_45%,#eef7ff_100%)] p-6 shadow-[0_24px_70px_rgba(11,31,26,0.08)] md:p-8">
        <div className="absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_center,rgba(30,93,176,0.14),transparent_58%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dce8f8] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-info shadow-sm">
              <ClipboardPenLine className="h-3.5 w-3.5" />
              Consultation Studio
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              Turn every booked appointment into a structured clinical note.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted md:text-[15px]">
              Each appointment carries its own consultation record. Save drafts as you work, then
              finalize the patient-safe summary once the visit is complete.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/92 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Encounters</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{encounterAppointments.length}</p>
                <p className="mt-2 text-sm text-muted">Booked visits ready for documentation.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#1e5db0] p-4 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Finalized</p>
                <p className="mt-3 text-3xl font-semibold">{finalizedCount}</p>
                <p className="mt-2 text-sm text-white/80">Notes visible as patient-ready consultation summaries.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#fff8ef] p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a85b1b]">Pending</p>
                <p className="mt-3 text-3xl font-semibold text-[#6b3510]">{undocumentedCount + draftCount}</p>
                <p className="mt-2 text-sm text-[#8a5d3d]">Visits still waiting for a polished final note.</p>
              </div>
            </div>
          </div>

          <Card className="rounded-[28px] border-[#dce7f7] bg-white/90 shadow-[0_14px_40px_rgba(11,31,26,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">How to work</p>
            <div className="mt-5 space-y-4">
              {[
                {
                  title: 'Pick a booked appointment',
                  detail: 'Every appointment owns a separate consultation record.'
                },
                {
                  title: 'Capture the internal note',
                  detail: 'Use subjective, objective, assessment, and plan to structure the encounter.'
                },
                {
                  title: 'Finalize the patient-safe view',
                  detail: 'Patients only see the summary and follow-up plan you publish.'
                }
              ].map((item, index) => (
                <div key={item.title} className="flex gap-4 rounded-2xl bg-[#f6f8ff] px-4 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e5db0] text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">{item.detail}</p>
                  </div>
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

      <section className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f4f8ff_100%)] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Appointment ledger</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Select an encounter</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="px-6 py-5">
                  <div className="h-4 w-44 animate-pulse rounded bg-[#e8eef8]" />
                  <div className="mt-3 h-3 w-60 animate-pulse rounded bg-[#eef4fb]" />
                </div>
              ))
            ) : encounterAppointments.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted">
                No booked encounters are available yet. Once patients reserve a slot, the visit will
                appear here for documentation.
              </div>
            ) : (
              encounterAppointments.map((appointment) => {
                const consultation = consultationMap[appointment.id] || null;
                const tone = getConsultationTone(consultation);
                const active = appointment.id === selectedAppointment?.id;

                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => setSelectedAppointmentId(appointment.id)}
                    className={`w-full px-6 py-5 text-left transition ${
                      active ? 'bg-[#f5f8ff]' : 'bg-white hover:bg-[#fafcff]'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#e9f1ff_0%,#dfefff_100%)] text-info">
                        <span className="text-sm font-semibold">{getInitials(appointment.patient?.full_name)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-ink">
                            {appointment.patient?.full_name || 'Patient'}
                          </p>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone.className}`}>
                            {tone.label}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="h-4 w-4" />
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
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_100%)] px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Clinical editor</p>
                <h2 className="mt-2 text-xl font-semibold text-ink">
                  {selectedAppointment?.patient?.full_name || 'Select an appointment'}
                </h2>
              </div>
              {selectedAppointment?.patient?.id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/doctor/patients/${selectedAppointment.patient?.id}`)}
                >
                  Open chart
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {!selectedAppointment ? (
            <div className="px-6 py-10 text-sm text-muted">
              Select an appointment from the ledger to start documenting the consultation.
            </div>
          ) : (
            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-[#e6edf8] bg-[#f8fbff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Visit day</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatDayLabel(selectedAppointment.availability?.start_at)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {formatDateTime(selectedAppointment.availability?.start_at)}
                  </p>
                </div>
                <div className="rounded-3xl border border-[#e6edf8] bg-[#f8fbff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Mode</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {selectedAppointment.availability?.mode === 'video' ? 'Video consultation' : 'Clinic consultation'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {selectedAppointment.reason || 'No patient reason submitted.'}
                  </p>
                </div>
                <div className="rounded-3xl border border-[#e6edf8] bg-[#f8fbff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Note state</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {selectedConsultation?.status === 'finalized'
                      ? 'Finalized'
                      : selectedConsultation?.status === 'draft'
                        ? 'Draft saved'
                        : 'New note'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {selectedConsultation?.updated_at
                      ? `Last updated ${formatDateTime(selectedConsultation.updated_at)}`
                      : 'This encounter does not have a consultation yet.'}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Chief complaint
                  </label>
                  <Input
                    value={form.chief_complaint}
                    onChange={(event) => setForm((current) => ({ ...current, chief_complaint: event.target.value }))}
                    placeholder="Primary problem discussed during this encounter."
                  />
                </div>
                <div className="rounded-3xl border border-[#e4edf7] bg-[#f9fbff] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#dceaff_0%,#cfe3ff_100%)] text-info">
                      <BrainCircuit className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">AI draft lane</p>
                      <p className="mt-1 text-sm text-ink">
                        Keep raw AI capture separate from your finalized doctor note.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Subjective note
                  </label>
                  <textarea
                    className="min-h-[150px] w-full rounded-[24px] border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
                    value={form.subjective_note}
                    onChange={(event) => setForm((current) => ({ ...current, subjective_note: event.target.value }))}
                    placeholder="Symptoms, history, and patient-reported details."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Objective note
                  </label>
                  <textarea
                    className="min-h-[150px] w-full rounded-[24px] border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
                    value={form.objective_note}
                    onChange={(event) => setForm((current) => ({ ...current, objective_note: event.target.value }))}
                    placeholder="Observed findings, exam highlights, or measurable details."
                  />
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Assessment
                  </label>
                  <textarea
                    className="min-h-[150px] w-full rounded-[24px] border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
                    value={form.assessment}
                    onChange={(event) => setForm((current) => ({ ...current, assessment: event.target.value }))}
                    placeholder="Clinical assessment, working diagnosis, or risk judgement."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Plan
                  </label>
                  <textarea
                    className="min-h-[150px] w-full rounded-[24px] border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
                    value={form.plan}
                    onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))}
                    placeholder="Treatment plan, follow-up, medicines, and next steps."
                  />
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Patient summary
                  </label>
                  <textarea
                    className="min-h-[170px] w-full rounded-[24px] border border-border bg-[#fbfdff] px-4 py-3 text-sm text-ink outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
                    value={form.patient_summary}
                    onChange={(event) => setForm((current) => ({ ...current, patient_summary: event.target.value }))}
                    placeholder="Plain-language summary that the patient will read."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    AI draft note
                  </label>
                  <textarea
                    className="min-h-[170px] w-full rounded-[24px] border border-border bg-[#fbfdff] px-4 py-3 text-sm text-ink outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
                    value={form.ai_draft_note}
                    onChange={(event) => setForm((current) => ({ ...current, ai_draft_note: event.target.value }))}
                    placeholder="Optional AI-generated raw summary for doctor review."
                  />
                </div>
              </div>

              {formError ? <p className="text-sm font-medium text-danger">{formError}</p> : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={savingStatus === 'draft'}
                  onClick={() => persistConsultation('draft')}
                >
                  <FileText className="h-4 w-4" />
                  Save draft
                </Button>
                <Button
                  type="button"
                  isLoading={savingStatus === 'finalized'}
                  onClick={() => persistConsultation('finalized')}
                >
                  <Sparkles className="h-4 w-4" />
                  Finalize consultation
                </Button>
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
