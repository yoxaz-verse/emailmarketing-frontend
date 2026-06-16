import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Mail, Network, BarChart3, Fingerprint, Zap } from "lucide-react";
import { isTokenExpired } from "@/lib/auth-session";

export default async function LandingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const hasToken = Boolean(token) && !isTokenExpired(token);

  const ctaHref = hasToken ? '/dashboard' : '/login';
  const ctaLabel = hasToken ? 'Go to Dashboard' : 'Sign in';

  const capabilities = [
    { icon: Fingerprint, text: "Lead validation & hygiene enforcement" },
    { icon: Zap, text: "Inbox warm-up with adaptive ramping" },
    { icon: ShieldCheck, text: "Sending infrastructure & domain protection" },
    { icon: Mail, text: "Reply detection & intent classification" },
    { icon: Network, text: "Bounce intelligence & auto-suppression" },
    { icon: BarChart3, text: "Operator-level monitoring & controls" },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col justify-between">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-0 inset-x-0 h-full w-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-18%] left-[-10%] w-[48%] h-[48%] bg-primary/14 blur-[120px]" />
        <div className="absolute bottom-[-12%] right-[-8%] w-[38%] h-[38%] bg-white/6 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      </div>

      <main className="flex-grow">
        {/* HERO SECTION */}
        <section className="px-6 py-14 md:py-20 max-w-7xl mx-auto relative z-10 animate-fade-in-up">
          <div className="max-w-4xl">
            <Image
              src="/logo.png"
              alt="OBAOL"
              width={220}
              height={114}
              priority
              className="mb-6 h-auto w-36 md:w-48"
            />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-card border-primary/20 text-xs font-medium text-primary mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              OBAOL OVERVIEW
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight">
              Outbound Email
              <br />
              <span className="text-gradient">
                Built as Infrastructure
              </span>
            </h1>

            <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              OBAOL is not a campaign tool. It is an execution system designed for outbound teams that operate at scale — combining lead validation, warm-up, delivery control, monitoring, and compliance into a single operational layer.
            </p>

            {/* SMART CTA */}
            <div className="mt-8 flex items-center gap-4">
              <Link
                href={ctaHref}
                className="group relative inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-8 py-4 text-base font-semibold hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_36px_-12px_var(--color-primary)]"
              >
                {ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        {/* VALUE GRID */}
        <section className="px-6 py-24 relative z-10">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="glass-card rounded-2xl p-8 hover:-translate-y-2 transition-all duration-300 hover:border-primary/50 group">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-semibold">Execution, Not Automation</h3>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                OBAOL does not blindly send emails. Every layer — from inbox health to lead authenticity — is designed to protect deliverability and reputation.
              </p>
            </div>

            <div className="glass-card rounded-2xl p-8 hover:-translate-y-2 transition-all duration-300 hover:border-primary/50 group">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Network className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-semibold">Built for Operators</h3>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Designed for founders, BD heads, SDR managers, and outbound operators who need predictable outcomes, not vanity metrics.
              </p>
            </div>

            <div className="glass-card rounded-2xl p-8 hover:-translate-y-2 transition-all duration-300 hover:border-primary/50 group">
              <div className="h-12 w-12 rounded-xl bg-white/5 text-primary flex items-center justify-center mb-6 ring-1 ring-primary/20 group-hover:scale-110 transition-transform">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-semibold">System-Level Control</h3>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                From warm-up pacing to sending limits, from reply classification to bounce intelligence — control exists at the system level.
              </p>
            </div>
          </div>
        </section>

        {/* CAPABILITIES */}
        <section className="px-6 py-24 relative z-10">
          <div className="max-w-7xl mx-auto glass-panel rounded-3xl p-8 md:p-16 border-t border-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            
            <h2 className="text-3xl md:text-5xl font-bold mb-12">Core Capabilities</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
              {capabilities.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 bg-background/50 hover:bg-background/80 transition-colors border border-border rounded-2xl p-6 group cursor-default"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <p className="font-medium text-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* POSITIONING BLOCK */}
        <section className="px-6 py-32 relative z-10 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-bold leading-tight">
              This is not mass email.
              <br />
              <span className="text-gradient">This is outbound execution.</span>
            </h2>

            <p className="mt-8 text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              OBAOL exists to replace fragile stacks, disconnected tools, and guesswork — with a single, disciplined execution layer.
            </p>
          </div>
        </section>
      </main>

      <footer className="px-6 py-8 relative z-10 border-t border-border/50 text-center text-sm text-muted-foreground backdrop-blur-md bg-background/50">
        © {new Date().getFullYear()} OBAOL · Cold Email Marketing Infrastructure
      </footer>
    </div>
  );
}
