'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BrainCircuit,
  CalendarClock,
  ClipboardPenLine,
  FileText,
  MapPin,
  Sparkles,
  Stethoscope,
  Video
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type {
  AiNotePayload,
  Appointment,
  Consultation,
  ConsultationStatus,
  Patient,
  Prescription,
  VideoVisit
} from '@/types';

interface PatientDetailResponse {
  data: Patient;
}

interface AppointmentResponse {
  data: Appointment[];
}

interface ConsultationResponse {
  data: Consultation[];
}

interface PrescriptionResponse {
  data: Prescription[];
}

interface VisitResponse {
  data: VideoVisit;
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

interface PrescriptionFormItem {
  medicine_name: string;
  strength: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  timing: string;
  instructions: string;
}

interface PrescriptionFormState {
  notes: string;
  items: PrescriptionFormItem[];
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

const EMPTY_PRESCRIPTION_ITEM: PrescriptionFormItem = {
  medicine_name: '',
  strength: '',
  dosage: '',
  frequency: '',
  duration: '',
  route: '',
  timing: '',
  instructions: ''
};

const EMPTY_PRESCRIPTION_FORM: PrescriptionFormState = {
  notes: '',
  items: [{ ...EMPTY_PRESCRIPTION_ITEM }]
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

function getStatusTone(status: string) {
  if (status === 'finalized' || status === 'completed') {
    return 'bg-[#e6f7f0] text-primary';
  }
  if (status === 'draft' || status === 'booked') {
    return 'bg-[#fff3e9] text-[#a85b1b]';
  }
  if (status === 'cancelled') {
    return 'bg-[#fdeeee] text-danger';
  }
  return 'bg-[#eef3f0] text-muted';
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

function buildPrescriptionForm(prescription: Prescription | null): PrescriptionFormState {
  if (!prescription) return EMPTY_PRESCRIPTION_FORM;

  return {
    notes: prescription.notes || '',
    items: prescription.items.length
      ? prescription.items.map((item) => ({
          medicine_name: item.medicine_name || '',
          strength: item.strength || '',
          dosage: item.dosage || '',
          frequency: item.frequency || '',
          duration: item.duration || '',
          route: item.route || '',
          timing: item.timing || '',
          instructions: item.instructions || ''
        }))
      : [{ ...EMPTY_PRESCRIPTION_ITEM }]
  };
}

function validatePrescriptionForm(form: PrescriptionFormState) {
  const cleanedItems = form.items.filter((item) =>
    Object.values(item).some((value) => value.trim())
  );

  if (!cleanedItems.length) {
    return { error: 'Add at least one medicine to save a prescription.', items: [] };
  }

  for (const item of cleanedItems) {
    if (!item.medicine_name.trim()) {
      return { error: 'Medicine name is required for every prescription row.', items: [] };
    }
  }

  return { error: null, items: cleanedItems };
}

function mergeAiDraftIntoForm(form: ConsultationFormState, draft: AiNotePayload): ConsultationFormState {
  return {
    chief_complaint: draft.chief_complaint || form.chief_complaint,
    subjective_note: draft.subjective_note || form.subjective_note,
    objective_note: draft.objective_note || form.objective_note,
    assessment: draft.assessment || form.assessment,
    plan: draft.plan || form.plan,
    patient_summary: draft.patient_summary || form.patient_summary,
    ai_draft_note: draft.ai_draft_note || form.ai_draft_note
  };
}

export default function PatientDetail({ patientId }: { patientId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const requestedAppointmentId = searchParams.get('appointment');
  const [patient, setPatient] = React.useState<Patient | null>(null);
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [consultations, setConsultations] = React.useState<Consultation[]>([]);
  const [prescriptions, setPrescriptions] = React.useState<Prescription[]>([]);
  const [activeTab, setActiveTab] = React.useState<'overview' | 'consultations' | 'prescriptions' | 'appointments'>('overview');
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<ConsultationFormState>(EMPTY_FORM);
  const [prescriptionForm, setPrescriptionForm] = React.useState<PrescriptionFormState>(EMPTY_PRESCRIPTION_FORM);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);
  const [savingStatus, setSavingStatus] = React.useState<ConsultationStatus | null>(null);
  const [savingPrescription, setSavingPrescription] = React.useState(false);
  const [pullingVisitDraft, setPullingVisitDraft] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [prescriptionError, setPrescriptionError] = React.useState<string | null>(null);
  const [visitDraftMessage, setVisitDraftMessage] = React.useState<string | null>(null);
  const autoPulledAppointmentIdsRef = React.useRef<Set<string>>(new Set());

  const loadPatientWorkspace = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [patientResponse, appointmentResponse, consultationResponse, prescriptionResponse] = await Promise.all([
        api.get<PatientDetailResponse>(`/patients/${patientId}`),
        api.get<AppointmentResponse>('/appointments'),
        api.get<ConsultationResponse>('/consultations'),
        api.get<PrescriptionResponse>('/prescriptions')
      ]);
      setPatient(patientResponse.data);
      setAppointments(appointmentResponse.data.filter((item) => item.patient?.id === patientId));
      setConsultations(consultationResponse.data.filter((item) => item.patient?.id === patientId));
      setPrescriptions(prescriptionResponse.data.filter((item) => item.patient?.id === patientId));
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to load patient');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => {
    loadPatientWorkspace();
  }, [loadPatientWorkspace]);

  const sortedAppointments = [...appointments].sort((left, right) => {
    const leftTime = left.availability ? new Date(left.availability.start_at).getTime() : 0;
    const rightTime = right.availability ? new Date(right.availability.start_at).getTime() : 0;
    return rightTime - leftTime;
  });
  const finalizedConsultations = consultations.filter((item) => item.status === 'finalized').length;
  const draftConsultations = consultations.filter((item) => item.status === 'draft').length;
  const prescriptionCount = prescriptions.length;
  const consultationMap = Object.fromEntries(
    consultations.map((consultation) => [consultation.appointment_id, consultation])
  );
  const prescriptionMap = Object.fromEntries(
    prescriptions.map((prescription) => [prescription.consultation_id, prescription])
  );
  const selectedAppointment =
    sortedAppointments.find((appointment) => appointment.id === selectedAppointmentId) ||
    sortedAppointments[0] ||
    null;
  const selectedConsultation = selectedAppointment
    ? consultationMap[selectedAppointment.id] || null
    : null;
  const selectedPrescription = selectedConsultation
    ? prescriptionMap[selectedConsultation.id] || null
    : null;
  const isVideoAppointment = selectedAppointment?.availability?.mode === 'video';

  React.useEffect(() => {
    if (
      requestedTab === 'consultations' ||
      requestedTab === 'prescriptions' ||
      requestedTab === 'appointments' ||
      requestedTab === 'overview'
    ) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  React.useEffect(() => {
    if (!sortedAppointments.length) {
      setSelectedAppointmentId(null);
      return;
    }

    if (requestedAppointmentId && sortedAppointments.some((item) => item.id === requestedAppointmentId)) {
      setSelectedAppointmentId(requestedAppointmentId);
      return;
    }

    if (selectedAppointmentId && sortedAppointments.some((item) => item.id === selectedAppointmentId)) {
      return;
    }

    setSelectedAppointmentId(sortedAppointments[0].id);
  }, [requestedAppointmentId, selectedAppointmentId, sortedAppointments]);

  React.useEffect(() => {
    setForm(buildFormState(selectedConsultation));
    setFormError(null);
    setVisitDraftMessage(null);
  }, [selectedConsultation?.id, selectedAppointment?.id]);

  React.useEffect(() => {
    setPrescriptionForm(buildPrescriptionForm(selectedPrescription));
    setPrescriptionError(null);
  }, [selectedPrescription?.id, selectedConsultation?.id]);

  React.useEffect(() => {
    if (activeTab !== 'consultations') return;
    if (!selectedAppointment || selectedAppointment.availability?.mode !== 'video') return;
    if (selectedConsultation) return;
    if (autoPulledAppointmentIdsRef.current.has(selectedAppointment.id)) return;

    void handlePullAiDraftFromVisit({ silent: true, auto: true });
  }, [activeTab, selectedAppointment?.id, selectedAppointment?.availability?.mode, selectedConsultation?.id]);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="h-4 w-40 rounded bg-[#e8f1ed]" />
        <div className="mt-4 h-3 w-56 rounded bg-[#eef5f2]" />
        <div className="mt-4 h-3 w-48 rounded bg-[#eef5f2]" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-danger/30 bg-[#fdf4f4]">
        <p className="text-sm font-semibold text-danger">{error}</p>
      </Card>
    );
  }

  if (!patient) {
    return (
      <Card>
        <p className="text-sm text-muted">Patient not found.</p>
      </Card>
    );
  }

  const address = patient.address
    ? `${patient.address.line1 || ''} ${patient.address.city || ''}`.trim()
    : 'NA';

  async function handleDelete() {
    const confirmed = window.confirm('Delete this patient record? This action cannot be undone.');
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await api.delete(`/patients/${patientId}`);
      router.push('/doctor/patients');
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to delete patient');
      setDeleting(false);
    }
  }

  async function handleSaveConsultation(status: ConsultationStatus) {
    if (!selectedAppointment) {
      setFormError('Select an appointment before creating or updating a consultation note.');
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

      await loadPatientWorkspace();
      setActiveTab('consultations');
    } catch (err: any) {
      setFormError(err?.error?.message ?? 'Unable to save consultation');
    } finally {
      setSavingStatus(null);
    }
  }

  async function handlePullAiDraftFromVisit(options?: { silent?: boolean; auto?: boolean }) {
    if (!selectedAppointment) {
      if (!options?.silent) {
        setFormError('Select an appointment before pulling an AI draft.');
      }
      return;
    }

    if (selectedAppointment.availability?.mode !== 'video') {
      if (!options?.silent) {
        setFormError('AI draft pull is only available for video consultations.');
      }
      return;
    }

    setPullingVisitDraft(true);
    setFormError(null);
    if (!options?.silent) {
      setVisitDraftMessage(null);
    }

    try {
      const response = await api.get<VisitResponse>(`/video-visits/appointment/${selectedAppointment.id}`);
      if (!response.data.ai_note_payload) {
        if (!options?.silent) {
          setVisitDraftMessage('No AI draft is available yet for this visit room.');
        }
        return;
      }

      setForm((current) => mergeAiDraftIntoForm(current, response.data.ai_note_payload!));
      autoPulledAppointmentIdsRef.current.add(selectedAppointment.id);
      setVisitDraftMessage(
        options?.auto
          ? 'AI draft loaded automatically from the linked video visit.'
          : 'Latest AI draft loaded from the video room. Review it before saving.'
      );
    } catch (err: any) {
      if (!options?.silent) {
        setFormError(err?.error?.message ?? 'Unable to pull AI draft from the visit room');
      }
    } finally {
      setPullingVisitDraft(false);
    }
  }

  function handleOpenVideoRoom() {
    if (!selectedAppointment || selectedAppointment.availability?.mode !== 'video') return;
    window.open(
      `/doctor/appointments/${selectedAppointment.id}/visit`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  async function handleSavePrescription() {
    if (!selectedConsultation) {
      setPrescriptionError('Create or select a consultation before managing its prescription.');
      return;
    }

    const validation = validatePrescriptionForm(prescriptionForm);
    if (validation.error) {
      setPrescriptionError(validation.error);
      return;
    }

    setSavingPrescription(true);
    setPrescriptionError(null);
    setError(null);

    const payload = {
      consultation_id: selectedConsultation.id,
      notes: prescriptionForm.notes,
      items: validation.items
    };

    try {
      if (selectedPrescription) {
        await api.patch(`/prescriptions/${selectedPrescription.id}`, payload);
      } else {
        await api.post('/prescriptions', payload);
      }

      await loadPatientWorkspace();
      setActiveTab('prescriptions');
    } catch (err: any) {
      setPrescriptionError(err?.error?.message ?? 'Unable to save prescription');
    } finally {
      setSavingPrescription(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-[#d7e5dd] bg-[linear-gradient(135deg,#ffffff_0%,#f3faf6_100%)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Patient Chart
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink">{patient.full_name}</h1>
            <p className="mt-2 text-sm text-muted">{patient.mobile}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" type="button" onClick={() => router.push('/doctor/patients')}>
              Back to list
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => router.push(`/doctor/patients/${patientId}/edit`)}
            >
              Edit patient
            </Button>
            <Button variant="ghost" type="button" isLoading={deleting} onClick={handleDelete}>
              Delete patient
            </Button>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm font-medium text-danger">{error}</p> : null}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Date of birth
            </p>
            <p className="mt-1 text-sm text-ink">{patient.date_of_birth}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Gender
            </p>
            <p className="mt-1 text-sm text-ink">{patient.gender}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Blood group
            </p>
            <p className="mt-1 text-sm text-ink">{patient.blood_group || 'NA'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              AI Consent
            </p>
            <p className="mt-1 text-sm text-ink">
              {patient.ai_consent ? 'Granted' : 'Not granted'}
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-[#dbe7df] bg-white/90 p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'consultations', label: 'Consultations' },
            { id: 'prescriptions', label: 'Prescriptions' },
            { id: 'appointments', label: 'Appointments' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as 'overview' | 'consultations' | 'prescriptions' | 'appointments')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === item.id
                  ? 'bg-[linear-gradient(135deg,#0f6e56_0%,#17916f_100%)] text-white shadow-[0_12px_24px_rgba(15,110,86,0.2)]'
                  : 'bg-[#f4f8f6] text-ink hover:bg-[#edf5f1]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {activeTab === 'overview' ? (
        <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <Card>
            <h2 className="text-lg font-semibold text-ink">Contact & Address</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Email
                </p>
                <p className="mt-1 text-sm text-ink">{patient.email || 'NA'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  ABHA ID
                </p>
                <p className="mt-1 text-sm text-ink">{patient.abha_id || 'NA'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Address
                </p>
                <p className="mt-1 text-sm text-ink">{address || 'NA'}</p>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden border-[#dce9f7] bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_100%)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Clinical snapshot</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-[#e0ebf7] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Appointments</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{sortedAppointments.length}</p>
              </div>
              <div className="rounded-3xl border border-[#e0ebf7] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Finalized notes</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{finalizedConsultations}</p>
              </div>
              <div className="rounded-3xl border border-[#e0ebf7] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Draft notes</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{draftConsultations}</p>
              </div>
              <div className="rounded-3xl border border-[#e0ebf7] bg-white p-4 sm:col-span-3 xl:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Prescriptions</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{prescriptionCount}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={() => setActiveTab('consultations')}>
                <ClipboardPenLine className="h-4 w-4" />
                Manage consultations
              </Button>
              <Button type="button" variant="outline" onClick={() => setActiveTab('appointments')}>
                <CalendarClock className="h-4 w-4" />
                View appointments
              </Button>
              <Button type="button" variant="outline" onClick={() => setActiveTab('prescriptions')}>
                <FileText className="h-4 w-4" />
                Manage prescriptions
              </Button>
            </div>
          </Card>
        </section>
      ) : null}

      {activeTab === 'consultations' ? (
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f6fbff_100%)] px-6 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Consultation lane
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Choose a patient appointment</h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                  <span className="rounded-full bg-[#e6f7f0] px-3 py-1 text-primary">
                    {finalizedConsultations} finalized
                  </span>
                  <span className="rounded-full bg-[#fff3e9] px-3 py-1 text-[#a85b1b]">
                    {draftConsultations} draft
                  </span>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border">
              {sortedAppointments.length === 0 ? (
                <div className="px-6 py-10 text-sm text-muted">
                  This patient does not have any appointments yet, so there is no consultation record to manage.
                </div>
              ) : (
                sortedAppointments.map((appointment) => {
                  const consultation = consultationMap[appointment.id] || null;
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
                          {appointment.reason || 'Booked appointment'}
                        </p>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getStatusTone(
                            consultation?.status || appointment.status
                          )}`}
                        >
                          {consultation ? consultation.status : 'no note'}
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
                            <MapPin className="h-4 w-4" />
                          )}
                          {appointment.availability?.mode === 'video' ? 'Video visit' : 'In-person visit'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_100%)] px-6 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Consultation editor
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">
                    {selectedAppointment ? 'Document this visit' : 'Select an appointment'}
                  </h2>
                </div>
                {selectedAppointment ? (
                  <div className="flex flex-wrap gap-3">
                    {isVideoAppointment ? (
                      <Button type="button" variant="outline" onClick={handleOpenVideoRoom}>
                        <Video className="h-4 w-4" />
                        Open video room
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab('appointments')}
                    >
                      <FileText className="h-4 w-4" />
                      Visit timeline
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            {!selectedAppointment ? (
              <div className="px-6 py-10 text-sm text-muted">
                Choose an appointment from the left to create, review, or finalize its consultation.
              </div>
            ) : (
              <div className="space-y-6 px-6 py-6">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-3xl border border-[#e5edf8] bg-[#f8fbff] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Visit time</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {formatDateTime(selectedAppointment.availability?.start_at)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[#e5edf8] bg-[#f8fbff] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Appointment mode</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {selectedAppointment.availability?.mode === 'video' ? 'Video consultation' : 'Clinic consultation'}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[#e5edf8] bg-[#f8fbff] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Current note state</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {selectedConsultation ? selectedConsultation.status : 'Not started'}
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
                      placeholder="Primary complaint for this visit."
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
                          Keep raw AI capture separate from the final doctor-approved note.
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
                      className="min-h-[150px] w-full rounded-[24px] border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                      value={form.subjective_note}
                      onChange={(event) => setForm((current) => ({ ...current, subjective_note: event.target.value }))}
                      placeholder="Symptoms, patient history, and self-reported details."
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Objective note
                    </label>
                    <textarea
                      className="min-h-[150px] w-full rounded-[24px] border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                      value={form.objective_note}
                      onChange={(event) => setForm((current) => ({ ...current, objective_note: event.target.value }))}
                      placeholder="Observed findings, exam notes, or measurable details."
                    />
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Assessment
                    </label>
                    <textarea
                      className="min-h-[150px] w-full rounded-[24px] border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                      value={form.assessment}
                      onChange={(event) => setForm((current) => ({ ...current, assessment: event.target.value }))}
                      placeholder="Clinical assessment and working diagnosis."
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Plan
                    </label>
                    <textarea
                      className="min-h-[150px] w-full rounded-[24px] border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                      value={form.plan}
                      onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))}
                      placeholder="Treatment plan, medicines, follow-up, and next actions."
                    />
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Patient summary
                    </label>
                    <textarea
                      className="min-h-[170px] w-full rounded-[24px] border border-border bg-[#fbfdff] px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                      value={form.patient_summary}
                      onChange={(event) => setForm((current) => ({ ...current, patient_summary: event.target.value }))}
                      placeholder="Plain-language summary visible to the patient."
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      AI draft note
                    </label>
                    <textarea
                      className="min-h-[170px] w-full rounded-[24px] border border-border bg-[#fbfdff] px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                      value={form.ai_draft_note}
                      onChange={(event) => setForm((current) => ({ ...current, ai_draft_note: event.target.value }))}
                      placeholder="Optional AI-generated draft for doctor review."
                    />
                  </div>
                </div>

                {formError ? <p className="text-sm font-medium text-danger">{formError}</p> : null}
                {visitDraftMessage ? <p className="text-sm font-medium text-primary">{visitDraftMessage}</p> : null}

                <div className="flex flex-wrap gap-3">
                  {isVideoAppointment ? (
                    <Button
                      type="button"
                      variant="outline"
                      isLoading={pullingVisitDraft}
                      onClick={() => handlePullAiDraftFromVisit()}
                    >
                      <BrainCircuit className="h-4 w-4" />
                      Pull AI draft from visit
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    isLoading={savingStatus === 'draft'}
                    onClick={() => handleSaveConsultation('draft')}
                  >
                    <FileText className="h-4 w-4" />
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    isLoading={savingStatus === 'finalized'}
                    onClick={() => handleSaveConsultation('finalized')}
                  >
                    <Sparkles className="h-4 w-4" />
                    Finalize consultation
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!selectedConsultation}
                    onClick={() => setActiveTab('prescriptions')}
                  >
                    <FileText className="h-4 w-4" />
                    Manage prescription
                  </Button>
                  {selectedConsultation?.updated_at ? (
                    <p className="self-center text-sm text-muted">
                      Last updated {formatDateTime(selectedConsultation.updated_at)}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </Card>
        </section>
      ) : null}

      {activeTab === 'prescriptions' ? (
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f6fbff_100%)] px-6 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Prescription lane
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Choose the consultation visit</h2>
                </div>
                <span className="rounded-full bg-[#eaf4ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-info">
                  {prescriptionCount} prescription{prescriptionCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="divide-y divide-border">
              {sortedAppointments.length === 0 ? (
                <div className="px-6 py-10 text-sm text-muted">
                  This patient does not have any appointments yet.
                </div>
              ) : (
                sortedAppointments.map((appointment) => {
                  const consultation = consultationMap[appointment.id] || null;
                  const prescription = consultation ? prescriptionMap[consultation.id] || null : null;
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
                          {appointment.reason || consultation?.chief_complaint || 'Consultation visit'}
                        </p>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                            prescription
                              ? 'bg-[#e6f7f0] text-primary'
                              : consultation
                                ? 'bg-[#fff3e9] text-[#a85b1b]'
                                : 'bg-[#eef3f0] text-muted'
                          }`}
                        >
                          {prescription ? 'prescribed' : consultation ? 'ready to prescribe' : 'needs consultation'}
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
                            <MapPin className="h-4 w-4" />
                          )}
                          {appointment.availability?.mode === 'video' ? 'Video visit' : 'In-person visit'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_100%)] px-6 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Prescription editor
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">
                    {selectedAppointment ? 'Medication plan for this visit' : 'Select an appointment'}
                  </h2>
                </div>
                {selectedConsultation ? (
                  <Button type="button" variant="outline" onClick={() => setActiveTab('consultations')}>
                    <ClipboardPenLine className="h-4 w-4" />
                    Open consultation
                  </Button>
                ) : null}
              </div>
            </div>

            {!selectedAppointment ? (
              <div className="px-6 py-10 text-sm text-muted">
                Select an appointment to manage its prescription.
              </div>
            ) : !selectedConsultation ? (
              <div className="space-y-4 px-6 py-10">
                <p className="text-sm text-muted">
                  This visit does not have a consultation yet. Create the consultation first, then add the prescription.
                </p>
                <Button type="button" onClick={() => setActiveTab('consultations')}>
                  <ClipboardPenLine className="h-4 w-4" />
                  Create consultation first
                </Button>
              </div>
            ) : (
              <div className="space-y-6 px-6 py-6">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-3xl border border-[#e5edf8] bg-[#f8fbff] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Consultation</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {selectedConsultation.chief_complaint || 'Visit consultation'}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[#e5edf8] bg-[#f8fbff] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Prescription status</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {selectedPrescription ? 'Existing prescription' : 'New prescription'}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[#e5edf8] bg-[#f8fbff] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Patient-safe note</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {selectedConsultation.status === 'finalized' ? 'Finalized consultation' : 'Consultation draft'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Prescription notes
                  </label>
                  <textarea
                    className="min-h-[120px] w-full rounded-[24px] border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    value={prescriptionForm.notes}
                    onChange={(event) =>
                      setPrescriptionForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    placeholder="General medication guidance, safety note, or follow-up advice."
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Medicine rows</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setPrescriptionForm((current) => ({
                          ...current,
                          items: [...current.items, { ...EMPTY_PRESCRIPTION_ITEM }]
                        }))
                      }
                    >
                      Add medicine
                    </Button>
                  </div>

                  {prescriptionForm.items.map((item, index) => (
                    <div key={index} className="rounded-[28px] border border-[#dce7f4] bg-[#fbfdff] p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-ink">Medicine {index + 1}</p>
                        {prescriptionForm.items.length > 1 ? (
                          <button
                            type="button"
                            className="text-sm font-semibold text-danger"
                            onClick={() =>
                              setPrescriptionForm((current) => ({
                                ...current,
                                items: current.items.filter((_, itemIndex) => itemIndex !== index)
                              }))
                            }
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <Input
                          value={item.medicine_name}
                          onChange={(event) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              items: current.items.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, medicine_name: event.target.value } : entry
                              )
                            }))
                          }
                          placeholder="Medicine name"
                        />
                        <Input
                          value={item.strength}
                          onChange={(event) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              items: current.items.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, strength: event.target.value } : entry
                              )
                            }))
                          }
                          placeholder="Strength"
                        />
                        <Input
                          value={item.dosage}
                          onChange={(event) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              items: current.items.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, dosage: event.target.value } : entry
                              )
                            }))
                          }
                          placeholder="Dosage"
                        />
                        <Input
                          value={item.frequency}
                          onChange={(event) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              items: current.items.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, frequency: event.target.value } : entry
                              )
                            }))
                          }
                          placeholder="Frequency"
                        />
                        <Input
                          value={item.duration}
                          onChange={(event) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              items: current.items.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, duration: event.target.value } : entry
                              )
                            }))
                          }
                          placeholder="Duration"
                        />
                        <Input
                          value={item.route}
                          onChange={(event) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              items: current.items.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, route: event.target.value } : entry
                              )
                            }))
                          }
                          placeholder="Route"
                        />
                        <Input
                          value={item.timing}
                          onChange={(event) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              items: current.items.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, timing: event.target.value } : entry
                              )
                            }))
                          }
                          placeholder="Timing"
                        />
                        <Input
                          value={item.instructions}
                          onChange={(event) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              items: current.items.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, instructions: event.target.value } : entry
                              )
                            }))
                          }
                          placeholder="Instructions"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {prescriptionError ? <p className="text-sm font-medium text-danger">{prescriptionError}</p> : null}

                <div className="flex flex-wrap gap-3">
                  <Button type="button" isLoading={savingPrescription} onClick={handleSavePrescription}>
                    <FileText className="h-4 w-4" />
                    {selectedPrescription ? 'Update prescription' : 'Create prescription'}
                  </Button>
                  {selectedPrescription?.updated_at ? (
                    <p className="self-center text-sm text-muted">
                      Last updated {formatDateTime(selectedPrescription.updated_at)}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </Card>
        </section>
      ) : null}

      {activeTab === 'appointments' ? (
        <section>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#fff8f1_100%)] px-6 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Visit timeline
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Appointments linked to this patient</h2>
                </div>
                <Button type="button" variant="secondary" onClick={() => router.push('/doctor/appointments')}>
                  <Sparkles className="h-4 w-4" />
                  Open schedule board
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border">
              {sortedAppointments.length === 0 ? (
                <div className="px-6 py-10 text-sm text-muted">
                  This patient does not have any appointments yet.
                </div>
              ) : (
                sortedAppointments.map((appointment) => (
                  <div key={appointment.id} className="px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-ink">
                            {appointment.reason || 'Booked appointment'}
                          </p>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getStatusTone(
                              appointment.status
                            )}`}
                          >
                            {appointment.status}
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
                            {appointment.availability?.mode === 'video' ? 'Video visit' : 'In-person visit'}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedAppointmentId(appointment.id);
                          setActiveTab('consultations');
                        }}
                      >
                        <ClipboardPenLine className="h-4 w-4" />
                        {consultations.some((item) => item.appointment_id === appointment.id)
                          ? 'Manage note'
                          : 'Create note'}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
