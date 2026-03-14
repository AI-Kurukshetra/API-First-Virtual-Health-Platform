'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import type { AuthSession } from '@/types';

const DEMO_OTP = process.env.NEXT_PUBLIC_DEFAULT_OTP ?? '123456';

function formatMobile(value: string) {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.startsWith('91')) return `+${cleaned}`;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return cleaned ? `+${cleaned}` : '';
}

export default function LoginForm() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [step, setStep] = React.useState<'mobile' | 'otp'>('mobile');
  const [mobile, setMobile] = React.useState('');
  const [otp, setOtp] = React.useState(DEMO_OTP);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSend = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = { mobile: formatMobile(mobile) };
      await api.post('/auth/otp/send', payload);
      setStep('otp');
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = { mobile: formatMobile(mobile), otp };
      const session = await api.post<AuthSession>('/auth/otp/verify', payload);
      setSession(session);
      if (session.user.role === 'patient') {
        router.push('/patient/dashboard');
      } else {
        router.push('/doctor/dashboard');
      }
    } catch (err: any) {
      setError(err?.error?.message ?? 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-ink">Welcome back</h2>
        <p className="mt-2 text-sm text-muted">
          Secure sign-in for doctors, patients, and clinic admins.
        </p>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primaryLight/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Demo OTP: {DEMO_OTP}
      </div>

      {step === 'mobile' ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
              Mobile Number
            </label>
            <Input
              placeholder="+91 98765 43210"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm font-medium text-danger">{error}</p>
          ) : null}
          <Button className="w-full" isLoading={loading} onClick={handleSend}>
            Send OTP
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              OTP sent to
            </p>
            <p className="text-sm font-semibold text-ink">
              {formatMobile(mobile) || 'Unknown'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
              Enter OTP
            </label>
            <Input
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm font-medium text-danger">{error}</p>
          ) : null}
          <div className="flex flex-col gap-3">
            <Button className="w-full" isLoading={loading} onClick={handleVerify}>
              Verify & Continue
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep('mobile');
                setError(null);
              }}
            >
              Change number
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
