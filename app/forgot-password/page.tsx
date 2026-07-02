"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';

type Step = 'REQUEST' | 'VERIFY' | 'RESET' | 'SUCCESS';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('REQUEST');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [loading, setLoading] = useState(false);

    const API_URL = '/api/proxy';

    const handleRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (res.ok) {
                toast.success('Verification code sent');
                setStep('VERIFY');
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to send code');
            }
        } catch {
            toast.error('Connection error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/verify-reset-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });
            if (res.ok) {
                const data = await res.json();
                if (typeof data.reset_token !== 'string' || !data.reset_token) throw new Error('Reset authorization was not returned');
                setResetToken(data.reset_token);
                toast.success('Code verified');
                setStep('RESET');
            } else {
                const data = await res.json();
                toast.error(data.error || 'Invalid code');
            }
        } catch {
            toast.error('Connection error');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (newPassword.length < 12) {
            toast.error('Password must be at least 12 characters');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, new_password: newPassword, reset_token: resetToken })
            });
            if (res.ok) {
                toast.success('Password updated successfully');
                setStep('SUCCESS');
            } else {
                const data = await res.json();
                toast.error(data.error || 'Reset failed');
            }
        } catch {
            toast.error('Connection error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6 text-foreground">
            <div className="w-full max-w-md">
                {/* BRANDING */}
                <div className="mb-10 text-center">
                    <Image
                        src="/logo.png"
                        alt="OBAOL"
                        width={190}
                        height={99}
                        priority
                        className="mx-auto h-auto w-40"
                    />
                    <p className="text-muted-foreground text-sm mt-1">SECURITY INFRASTRUCTURE</p>
                </div>

                <div className="bg-card text-card-foreground p-8 rounded-2xl shadow-2xl border border-border">
                    {step === 'REQUEST' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-center mb-6">
                                <div className="p-3 bg-muted rounded-full">
                                    <Mail className="h-6 w-6 text-foreground" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-center">Forgot Password?</h2>
                            <p className="text-muted-foreground text-center text-sm mt-2 mb-8">
                                Enter your email and we&apos;ll send you a 6-digit code to reset your password.
                            </p>
                            <form onSubmit={handleRequest} className="space-y-4">
                                <div>
                                    <label htmlFor="reset-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Email address</label>
                                    <Input
                                        id="reset-email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="h-12 border-border focus:ring-ring rounded-xl"
                                    />
                                </div>
                                <Button type="submit" disabled={loading} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold transition-all">
                                    {loading ? 'Sending...' : 'Send Reset Code'}
                                </Button>
                            </form>
                        </div>
                    )}

                    {step === 'VERIFY' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-center mb-6">
                                <div className="p-3 bg-muted rounded-full">
                                    <ShieldCheck className="h-6 w-6 text-foreground" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-center">Enter Code</h2>
                            <p className="text-muted-foreground text-center text-sm mt-2 mb-8">
                                We&apos;ve sent a code to <span className="font-semibold text-foreground">{email}</span>.
                            </p>
                            <form onSubmit={handleVerify} className="space-y-4">
                                <div>
                                    <label htmlFor="reset-otp" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Verification Code</label>
                                    <Input
                                        id="reset-otp"
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        required
                                        className="h-12 border-border focus:ring-ring rounded-xl text-center text-2xl tracking-[0.5em] font-bold"
                                    />
                                </div>
                                <Button type="submit" disabled={loading} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold transition-all">
                                    {loading ? 'Verifying...' : 'Verify Code'}
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setStep('REQUEST')}
                                    className="w-full text-xs text-muted-foreground hover:text-foreground font-medium transition"
                                >
                                    Try a different email
                                </button>
                            </form>
                        </div>
                    )}

                    {step === 'RESET' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-center mb-6">
                                <div className="p-3 bg-muted rounded-full">
                                    <Lock className="h-6 w-6 text-foreground" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-center">New Password</h2>
                            <p className="text-muted-foreground text-center text-sm mt-2 mb-8">
                                Create a strong password to secure your account.
                            </p>
                            <form onSubmit={handleReset} className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <label htmlFor="new-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">New Password</label>
                                        <Input
                                            id="new-password"
                                            type="password"
                                            autoComplete="new-password"
                                            placeholder="Min. 12 characters"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            className="h-12 border-border focus:ring-ring rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="confirm-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Confirm Password</label>
                                        <Input
                                            id="confirm-password"
                                            type="password"
                                            autoComplete="new-password"
                                            placeholder="Repeat password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            className="h-12 border-border focus:ring-ring rounded-xl"
                                        />
                                    </div>
                                </div>
                                <Button type="submit" disabled={loading} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold transition-all">
                                    {loading ? 'Updating...' : 'Reset Password'}
                                </Button>
                            </form>
                        </div>
                    )}

                    {step === 'SUCCESS' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
                            <div className="flex justify-center mb-6">
                                <div className="p-3 bg-green-500/20 rounded-full">
                                    <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-300" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold">All Set!</h2>
                            <p className="text-muted-foreground text-sm mt-2 mb-8 px-4">
                                Your password has been updated successfully. You can now sign in with your new credentials.
                            </p>
                            <Button
                                onClick={() => router.push('/login')}
                                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold transition-all"
                            >
                                Back to Sign In
                            </Button>
                        </div>
                    )}
                </div>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => router.push('/login')}
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition group"
                    >
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
}
