export type UserRole = 'patient' | 'doctor' | 'admin';
export type AppointmentMode = 'video' | 'in_person';
export type AppointmentStatus = 'booked' | 'cancelled' | 'completed';
export type ConsultationStatus = 'draft' | 'finalized';
export type PaymentMethod = 'upi' | 'card' | 'cash';
export type PaymentStatus = 'paid' | 'refunded';
export type VideoVisitStatus = 'waiting' | 'live' | 'ended';

export interface AuthUser {
  id: string;
  full_name: string;
  mobile: string;
  role: UserRole;
  org_id?: string | null;
}

export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

export interface PatientAddress {
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface Patient {
  id: string;
  full_name: string;
  mobile: string;
  date_of_birth: string;
  gender: string;
  email?: string | null;
  abha_id?: string | null;
  blood_group?: string | null;
  ai_consent: boolean;
  address?: PatientAddress | null;
  created_at?: string;
}

export interface AppointmentDoctor {
  id: string;
  full_name: string;
}

export interface AppointmentMiniPatient {
  id: string;
  full_name: string;
  mobile?: string;
}

export interface AppointmentAvailability {
  id: string;
  start_at: string;
  end_at: string;
  mode: AppointmentMode;
  notes?: string | null;
}

export interface Appointment {
  id: string;
  status: AppointmentStatus;
  reason?: string | null;
  created_at?: string;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  availability: AppointmentAvailability | null;
  doctor: AppointmentDoctor | null;
  patient: AppointmentMiniPatient | null;
  payment?: {
    id: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
    status: PaymentStatus;
    transaction_ref: string;
    notes?: string | null;
    created_at?: string;
  } | null;
}

export interface ConsultationDoctor {
  id: string;
  full_name: string;
}

export interface ConsultationPatient {
  id: string;
  full_name: string;
  mobile?: string;
}

export interface ConsultationAppointment {
  id: string;
  status: AppointmentStatus;
  reason?: string | null;
  availability: AppointmentAvailability | null;
}

export interface Consultation {
  id: string;
  appointment_id: string;
  status: ConsultationStatus;
  created_at?: string;
  updated_at?: string;
  chief_complaint?: string | null;
  patient_summary?: string | null;
  plan?: string | null;
  doctor: ConsultationDoctor | null;
  patient: ConsultationPatient | null;
  appointment: ConsultationAppointment | null;
  subjective_note?: string | null;
  objective_note?: string | null;
  assessment?: string | null;
  ai_draft_note?: string | null;
}

export interface PrescriptionItem {
  id: string;
  medicine_name: string;
  strength?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  route?: string | null;
  timing?: string | null;
  instructions?: string | null;
  sort_order: number;
}

export interface PrescriptionConsultation {
  id: string;
  status: ConsultationStatus;
  chief_complaint?: string | null;
  patient_summary?: string | null;
  plan?: string | null;
}

export interface Prescription {
  id: string;
  consultation_id: string;
  appointment_id: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  doctor: ConsultationDoctor | null;
  patient: ConsultationPatient | null;
  consultation: PrescriptionConsultation | null;
  appointment: ConsultationAppointment | null;
  items: PrescriptionItem[];
}

export interface Payment {
  id: string;
  appointment_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_ref: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  doctor: ConsultationDoctor | null;
  patient: ConsultationPatient | null;
  availability: AppointmentAvailability | null;
}

export interface AiNotePayload {
  chief_complaint: string;
  subjective_note: string;
  objective_note: string;
  assessment: string;
  plan: string;
  patient_summary: string;
  ai_draft_note: string;
}

export interface VideoVisitSignal {
  id: string;
  visit_id: string;
  sender_id: string;
  sender_role: 'doctor' | 'patient';
  recipient_role: 'doctor' | 'patient';
  kind: 'ready' | 'offer' | 'answer' | 'ice-candidate' | 'leave';
  payload: Record<string, any>;
  created_at: string;
}

export interface VideoVisit {
  id: string;
  status: VideoVisitStatus;
  doctor_online: boolean;
  patient_online: boolean;
  doctor_joined_at?: string | null;
  patient_joined_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  transcript_text: string;
  ai_note_payload?: AiNotePayload | null;
  appointment: {
    id: string;
    status: AppointmentStatus;
    reason?: string | null;
    availability: AppointmentAvailability | null;
  } | null;
  consultation?: {
    id: string;
    status: ConsultationStatus;
    chief_complaint?: string | null;
    patient_summary?: string | null;
    plan?: string | null;
    ai_draft_note?: string | null;
  } | null;
  doctor: ConsultationDoctor | null;
  patient: ConsultationPatient | null;
}

export interface DoctorAvailabilitySlot extends AppointmentAvailability {
  status: 'available' | 'booked' | 'completed';
  appointment: {
    id: string;
    reason?: string | null;
    patient: AppointmentMiniPatient | null;
  } | null;
}

export interface AppointmentCatalogDoctor {
  id: string;
  full_name: string;
  slots: AppointmentAvailability[];
}
