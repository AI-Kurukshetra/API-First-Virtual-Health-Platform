import LoginForm from '@/components/auth/LoginForm';
import AuthRedirect from '@/components/auth/AuthRedirect';

const highlights = [
  {
    title: 'AI-native documentation',
    description: 'Generate SOAP notes and clinical prompts in seconds.'
  },
  {
    title: 'Zero-cost video visits',
    description: 'Native WebRTC powered consultations with no SDK fees.'
  },
  {
    title: 'India-ready compliance',
    description: 'OTP sign-in, ABHA-ready profiles, and secure audit trails.'
  }
];

export default function LoginPage() {
  return (
    <main className="auth-shell min-h-screen">
      <AuthRedirect />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-stretch gap-10 px-6 py-12 lg:flex-row lg:items-center">
        <section className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-primary/20 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            VirtualCare India
          </div>
          <div className="space-y-4">
            <h1 className="text-balance text-4xl font-semibold text-ink md:text-5xl">
              A focused, calm workspace for modern virtual clinics.
            </h1>
            <p className="max-w-xl text-base text-muted md:text-lg">
              Log in to orchestrate appointments, video visits, AI notes, and
              billing in a single unified space.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-soft"
              >
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-xs text-muted">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex-1">
          <div className="glass-card rounded-[32px] p-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                  Secure Access
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">
                  Sign in with OTP
                </h2>
              </div>
              <div className="rounded-2xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                Live Demo
              </div>
            </div>
            <div className="mt-8">
              <LoginForm />
            </div>
            <p className="mt-8 text-xs text-muted">
              By continuing, you agree to VirtualCare&apos;s data protection and
              privacy policies.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
