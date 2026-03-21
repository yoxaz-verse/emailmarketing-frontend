
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

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
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-neutral-950 text-white">
      {/* LEFT BRAND PANEL */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-neutral-900 via-neutral-900 to-black">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">OBAOL</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Cold Email Marketing · Execution Infrastructure
          </p>
        </div>

        <div className="max-w-md">
          <h2 className="text-4xl font-semibold leading-tight text-white">
            Cold Email Marketing
            <br />
            <span className="text-neutral-400">Ultimate Tool</span>
          </h2>

          <p className="mt-6 text-neutral-400 leading-relaxed">
            Built for serious operators.
            <br />
            Lead sourcing, verification, warm-up, delivery,
            tracking, and execution — engineered for scale.
          </p>

          <div className="mt-8 space-y-3 text-sm text-neutral-500">
            <p>• No gimmicks. No templates spam.</p>
            <p>• Infrastructure, not just campaigns.</p>
            <p>• Designed for real outbound teams.</p>
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
            <h2 className="text-2xl font-semibold tracking-tight">
              Sign in to OBAOL
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Access your cold email execution dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium animate-in fade-in slide-in-from-top-2">
              {error}
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
