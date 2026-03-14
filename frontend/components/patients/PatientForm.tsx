'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Patient } from '@/types';

interface PatientResponse {
  data: Patient;
}

interface PatientFormValues {
  full_name: string;
  mobile: string;
  date_of_birth: string;
  gender: string;
  email: string;
  abha_id: string;
  blood_group: string;
  ai_consent: boolean;
  address: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
}

type FieldErrors = Partial<Record<string, string>>;

const mobileRegex = /^\+[1-9]\d{9,14}$/;
const bloodGroupRegex = /^(A|B|AB|O)[+-]$/;

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  return value.trim().startsWith('+') ? `+${digits}` : `+${digits}`;
}

function formatZodErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }
  return fieldErrors;
}

const patientFormSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  mobile: z
    .string()
    .transform(normalizeMobile)
    .refine((value) => mobileRegex.test(value), 'Enter a valid mobile number'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['female', 'male', 'other', 'prefer_not_to_say']),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address')]),
  abha_id: z.string().max(40, 'ABHA ID must be 40 characters or fewer'),
  blood_group: z.union([
    z.literal(''),
    z.string().trim().toUpperCase().refine((value) => bloodGroupRegex.test(value), {
      message: 'Use a valid blood group like A+, B-, O+, AB-'
    })
  ]),
  ai_consent: z.boolean(),
  address: z.object({
    line1: z.string().max(160, 'Address is too long'),
    city: z.string().max(80, 'City is too long'),
    state: z.string().max(80, 'State is too long'),
    pincode: z.union([
      z.literal(''),
      z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits')
    ])
  })
});

const emptyValues: PatientFormValues = {
  full_name: '',
  mobile: '',
  date_of_birth: '',
  gender: 'female',
  email: '',
  abha_id: '',
  blood_group: '',
  ai_consent: false,
  address: {
    line1: '',
    city: '',
    state: '',
    pincode: ''
  }
};

function toFormValues(patient: Patient): PatientFormValues {
  return {
    full_name: patient.full_name ?? '',
    mobile: patient.mobile ?? '',
    date_of_birth: patient.date_of_birth ?? '',
    gender: patient.gender ?? 'female',
    email: patient.email ?? '',
    abha_id: patient.abha_id ?? '',
    blood_group: patient.blood_group ?? '',
    ai_consent: Boolean(patient.ai_consent),
    address: {
      line1: patient.address?.line1 ?? '',
      city: patient.address?.city ?? '',
      state: patient.address?.state ?? '',
      pincode: patient.address?.pincode ?? ''
    }
  };
}

function buildPayload(values: PatientFormValues) {
  const address = Object.fromEntries(
    Object.entries(values.address).filter(([, value]) => value.trim() !== '')
  );

  return {
    full_name: values.full_name.trim(),
    mobile: values.mobile.trim(),
    date_of_birth: values.date_of_birth,
    gender: values.gender,
    email: values.email.trim() || null,
    abha_id: values.abha_id.trim() || null,
    blood_group: values.blood_group.trim() || null,
    ai_consent: values.ai_consent,
    address: Object.keys(address).length ? address : null
  };
}

export default function PatientForm({ patientId }: { patientId?: string }) {
  const router = useRouter();
  const isEditing = Boolean(patientId);
  const [values, setValues] = React.useState<PatientFormValues>(emptyValues);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [loading, setLoading] = React.useState(isEditing);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!patientId) return;

    let mounted = true;

    async function loadPatient() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<PatientResponse>(`/patients/${patientId}`);
        if (mounted) {
          setValues(toFormValues(response.data));
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.error?.message ?? 'Unable to load patient');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPatient();

    return () => {
      mounted = false;
    };
  }, [patientId]);

  function updateField<K extends keyof PatientFormValues>(key: K, value: PatientFormValues[K]) {
    setError(null);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[String(key)];
      return next;
    });
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateAddressField(key: keyof PatientFormValues['address'], value: string) {
    setError(null);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`address.${key}`];
      return next;
    });
    setValues((current) => ({
      ...current,
      address: {
        ...current.address,
        [key]: value
      }
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const validation = patientFormSchema.safeParse(values);
    if (!validation.success) {
      setFieldErrors(formatZodErrors(validation.error));
      setError('Please fix the highlighted fields.');
      setSaving(false);
      return;
    }

    try {
      const payload = buildPayload({
        ...validation.data,
        mobile: validation.data.mobile,
        blood_group: validation.data.blood_group,
        email: validation.data.email,
        abha_id: validation.data.abha_id,
        address: validation.data.address
      });
      const response = isEditing
        ? await api.patch<PatientResponse>(`/patients/${patientId}`, payload)
        : await api.post<PatientResponse>('/patients', payload);

      if (!response?.data?.id) {
        throw new Error('Patient saved, but the response was incomplete.');
      }

      router.push(`/doctor/patients/${response.data.id}`);
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to save patient');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="h-4 w-40 rounded bg-[#e8f1ed]" />
        <div className="mt-4 h-11 rounded bg-[#eef5f2]" />
        <div className="mt-4 h-11 rounded bg-[#eef5f2]" />
        <div className="mt-4 h-11 rounded bg-[#eef5f2]" />
      </Card>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Patient Management
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink">
              {isEditing ? 'Edit patient' : 'Add patient'}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {isEditing
                ? 'Update demographic and contact information.'
                : 'Create a new patient chart for the clinic.'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(isEditing ? `/doctor/patients/${patientId}` : '/doctor/patients')}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {isEditing ? 'Save changes' : 'Create patient'}
            </Button>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm font-medium text-danger">{error}</p> : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Profile</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Full name
            </label>
            <Input
              required
              value={values.full_name}
              error={fieldErrors.full_name}
              onChange={(event) => updateField('full_name', event.target.value)}
              placeholder="Enter patient name"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Mobile
            </label>
            <Input
              required
              type="tel"
              value={values.mobile}
              error={fieldErrors.mobile}
              onChange={(event) => updateField('mobile', event.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Date of birth
            </label>
            <Input
              required
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={values.date_of_birth}
              error={fieldErrors.date_of_birth}
              onChange={(event) => updateField('date_of_birth', event.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Gender
            </label>
            <select
              className={`h-11 w-full rounded-2xl border bg-white px-4 text-sm text-ink outline-none transition focus:ring-2 ${
                fieldErrors.gender
                  ? 'border-danger/60 focus:border-danger/60 focus:ring-danger/20'
                  : 'border-border focus:border-primary/60 focus:ring-primary/20'
              }`}
              value={values.gender}
              onChange={(event) => updateField('gender', event.target.value)}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
            {fieldErrors.gender ? (
              <p className="mt-2 text-xs font-medium text-danger">{fieldErrors.gender}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Email
            </label>
            <Input
              type="email"
              value={values.email}
              error={fieldErrors.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="patient@example.com"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              ABHA ID
            </label>
            <Input
              value={values.abha_id}
              error={fieldErrors.abha_id}
              onChange={(event) => updateField('abha_id', event.target.value)}
              placeholder="ABHA ID"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Blood group
            </label>
            <Input
              value={values.blood_group}
              error={fieldErrors.blood_group}
              onChange={(event) => updateField('blood_group', event.target.value)}
              placeholder="A+, O-, AB+"
            />
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={values.ai_consent}
              onChange={(event) => updateField('ai_consent', event.target.checked)}
            />
            AI consent granted
          </label>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Address</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Address line
            </label>
            <Input
              value={values.address.line1}
              error={fieldErrors['address.line1']}
              onChange={(event) => updateAddressField('line1', event.target.value)}
              placeholder="Street, building, area"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              City
            </label>
            <Input
              value={values.address.city}
              error={fieldErrors['address.city']}
              onChange={(event) => updateAddressField('city', event.target.value)}
              placeholder="City"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              State
            </label>
            <Input
              value={values.address.state}
              error={fieldErrors['address.state']}
              onChange={(event) => updateAddressField('state', event.target.value)}
              placeholder="State"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Pincode
            </label>
            <Input
              value={values.address.pincode}
              error={fieldErrors['address.pincode']}
              onChange={(event) => updateAddressField('pincode', event.target.value)}
              placeholder="380015"
            />
          </div>
        </div>
      </Card>
    </form>
  );
}
