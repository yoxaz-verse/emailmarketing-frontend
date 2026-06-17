
'use client';

import Image from 'next/image';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const sessionMessage =
    searchParams.get('reason') === 'session-expired'
      ? 'Your session expired. Please sign in again.'
      : null;
  const urlError = searchParams.get('error');
  const visibleError = error || urlError;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setIsSuccess(true);
      setIsLoading(false);

      // Delay to let the user see the success state ("Authenticated")
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-background text-foreground">
      {/* LEFT BRAND PANEL */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[#15120d] via-[#080808] to-black text-white relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div>
          <Image
            src="/logo.png"
            alt="OBAOL"
            width={220}
            height={114}
            priority
            className="h-auto w-44"
          />
          <p className="mt-2 text-sm text-neutral-400">
            Cold Email Marketing · Execution Infrastructure
          </p>
        </div>

        <div className="max-w-md">
          <h2 className="text-4xl font-semibold leading-tight text-white">
            Cold Email Marketing
            <br />
            <span className="text-primary">Ultimate Tool</span>
          </h2>

          <p className="mt-6 text-neutral-400 leading-relaxed">
            Built for serious operators.
            <br />
            Lead sourcing, verification, warm-up, delivery,
            tracking, and execution — engineered for scale.
          </p>

          <div className="mt-8 space-y-3 text-sm text-neutral-400">
            <p><span className="text-primary">•</span> No gimmicks. No templates spam.</p>
            <p><span className="text-primary">•</span> Infrastructure, not just campaigns.</p>
            <p><span className="text-primary">•</span> Designed for real outbound teams.</p>
          </div>
        </div>

        <p className="text-xs text-neutral-600" suppressHydrationWarning>
          © {new Date().getFullYear()} OBAOL. All rights reserved.
        </p>
      </div>

      {/* RIGHT LOGIN PANEL */}
      <div className="flex items-center justify-center px-6 bg-background text-foreground">
        <div className="w-full max-w-md bg-card text-card-foreground rounded-2xl shadow-xl p-8 border border-border">

          <div className="mb-8 text-center">
            <Image
              src="/logo.png"
              alt="OBAOL"
              width={180}
              height={94}
              className="mx-auto mb-6 h-auto w-36 md:hidden"
            />
            <h2 className="text-2xl font-semibold tracking-tight">
              Sign in to OBAOL
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Access your cold email execution dashboard
            </p>
          </div>

          {sessionMessage && !visibleError && (
            <div className="mb-6 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary font-medium animate-in fade-in slide-in-from-top-2">
              {sessionMessage}
            </div>
          )}

          {visibleError && (
            <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium animate-in fade-in slide-in-from-top-2">
              {visibleError}
            </div>
          )}

          {isSuccess && (
            <div className="mb-6 rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-500 font-medium animate-in fade-in slide-in-from-top-2">
              Login successful! Redirecting...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Email address
              </label>
              <input
                name="email"
                type="email"
                required
                disabled={isLoading || isSuccess}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                disabled={isLoading || isSuccess}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-all duration-200"
              />
            </div>

            <div className="flex items-center justify-end">
              <a
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground transition"
              >
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className={`
                w-full rounded-lg py-2.5 text-sm font-medium transition-all duration-200
                flex items-center justify-center gap-2
                ${isSuccess
                  ? 'bg-green-500 text-white'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'}
                disabled:opacity-80 disabled:cursor-not-allowed
              `}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSuccess ? 'Authenticated' : isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            This is not a mass email tool.
            <br />
            This is outbound infrastructure.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
