import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, Fingerprint, Mail, Network, ShieldCheck, Zap } from "lucide-react";
import { isTokenExpired } from "@/lib/auth-session";

const capabilities = [
  { icon: Fingerprint, title: "Lead validation", text: "Keep risky and low-quality contacts out of your sending pipeline." },
  { icon: Zap, title: "Adaptive warm-up", text: "Ramp inbox volume safely as reputation and capacity improve." },
  { icon: ShieldCheck, title: "Domain protection", text: "Enforce sending limits and protect the infrastructure behind every campaign." },
  { icon: Mail, title: "Reply intelligence", text: "Detect replies and classify intent without manual inbox triage." },
  { icon: Network, title: "Bounce control", text: "Suppress failures automatically before they damage future delivery." },
  { icon: BarChart3, title: "Operator visibility", text: "See health, throughput, and risk across the entire outbound operation." },
] as const;

const principles = ["Validate before sending", "Protect every inbox and domain", "Turn replies into action"] as const;

export default async function LandingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const hasToken = Boolean(token) && !isTokenExpired(token);
  const ctaHref = hasToken ? "/api/auth/enter-dashboard" : "/login";
  const ctaLabel = hasToken ? "Open dashboard" : "Sign in to OBAOL";

  return (
    <div className="landing-page min-h-screen overflow-hidden bg-background">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="relative z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <nav aria-label="Primary navigation" className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="OBAOL home" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <Image src="/logo.png" alt="OBAOL" width={138} height={72} priority className="h-auto w-24 sm:w-28" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/developers/api" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">API guide</Link>
            <Link href={ctaHref} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-5">{hasToken ? "Dashboard" : "Sign in"}</Link>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className="hero-grid relative border-b border-border/50">
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-36">
            <div className="animate-fade-in-up">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />Outbound operations platform
              </div>
              <h1 className="max-w-4xl text-5xl font-bold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">Reliable outbound starts <span className="text-gradient">before send.</span></h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">OBAOL unifies lead validation, inbox health, delivery controls, reply intelligence, and compliance in one operational layer.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href={ctaHref} className="group inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-[0_14px_40px_-18px_var(--color-primary)] transition hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{ctaLabel}<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></Link>
                <Link href="#capabilities" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-card/60 px-6 font-semibold transition hover:border-primary/40 hover:bg-card">Explore capabilities</Link>
              </div>
            </div>

            <aside aria-label="OBAOL operating principles" className="relative lg:pl-10">
              <div className="status-card rounded-3xl border border-border/80 bg-card/80 p-6 shadow-2xl shadow-black/15 sm:p-8">
                <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-5">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Operating layer</p><p className="mt-1 text-xl font-semibold">Built for control</p></div>
                  <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />System ready</div>
                </div>
                <div className="space-y-3 py-6">
                  {principles.map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/50 p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="h-4 w-4" aria-hidden="true" /></span><span className="font-medium">{item}</span></div>)}
                </div>
                <p className="border-t border-border/70 pt-5 text-sm leading-6 text-muted-foreground">One system of record for the decisions that protect deliverability and turn outbound activity into measurable outcomes.</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="border-b border-border/50 bg-card/30" aria-label="Platform benefits">
          <div className="mx-auto grid max-w-7xl divide-y divide-border/60 px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0">
            {[["One workflow", "Replace disconnected validation, sending, and monitoring tools."], ["Safer scale", "Build volume around infrastructure health instead of guesswork."], ["Clearer action", "Give operators the signals they need without vanity metrics."]].map(([title, text]) => <div key={title} className="py-8 md:px-8 md:first:pl-0 md:last:pr-0"><p className="font-semibold text-primary">{title}</p><p className="mt-2 max-w-sm leading-7 text-muted-foreground">{text}</p></div>)}
          </div>
        </section>

        <section id="capabilities" className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Core capabilities</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Every critical control, in one place.</h2><p className="mt-5 text-lg leading-8 text-muted-foreground">A focused operating system for teams that care about reputation, consistency, and outcomes.</p></div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((item) => <article key={item.title} className="group bg-background p-7 transition-colors hover:bg-card sm:p-8"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:-translate-y-0.5"><item.icon className="h-5 w-5" aria-hidden="true" /></div><h3 className="mt-6 text-xl font-semibold">{item.title}</h3><p className="mt-3 leading-7 text-muted-foreground">{item.text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 sm:pb-28"><div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-primary/20 bg-primary/[0.07] px-6 py-12 text-center sm:px-12 sm:py-16"><h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Run outbound like infrastructure.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">Move from a fragile stack of tools to one disciplined execution layer.</p><Link href={ctaHref} className="group mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition hover:bg-primary/90">{ctaLabel}<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></Link></div></section>
      </main>

      <footer className="border-t border-border/60 px-5 py-8 text-sm text-muted-foreground sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} OBAOL. Outbound email infrastructure.</p><Link href="/developers/api" className="transition-colors hover:text-foreground">Developer API</Link></div></footer>
    </div>
  );
}
