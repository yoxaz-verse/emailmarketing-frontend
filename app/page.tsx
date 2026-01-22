import { serverFetch } from "@/lib/server/server-fetch";
import { cookies } from "next/headers";
import Link from "next/link";

export default async function LandingPage() {
  const cookieStore = await cookies();
  const hasToken = Boolean(cookieStore.get('auth_token'));

  const ctaHref = hasToken ? '/dashboard' : '/login';
  const ctaLabel = hasToken ? 'Go to Dashboard' : 'Sign in';

return (
    <div className="min-h-screen bg-white text-neutral-900">
      
      {/* HERO SECTION */}
      <section className="px-6 py-24 max-w-7xl mx-auto">
        <div className="max-w-4xl">
          <p className="text-sm uppercase tracking-widest text-neutral-500">
            OBAOL Overview
          </p>

          <h1 className="mt-6 text-4xl md:text-6xl font-semibold leading-tight">
            Cold Email Marketing
            <br />
            <span className="text-neutral-500">
              Built as Infrastructure
            </span>
          </h1>

          <p className="mt-8 text-lg text-neutral-600 max-w-3xl leading-relaxed">
            OBAOL is not a campaign tool.
            <br />
            It is an execution system designed for outbound teams that operate
            at scale — combining lead validation, warm-up, delivery control,
            monitoring, and compliance into a single operational layer.
          </p>

          {/* SMART CTA */}
          <div className="mt-10">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center rounded-xl
                         bg-black text-white px-8 py-3 text-sm font-medium
                         hover:bg-neutral-800 transition"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </section>

      {/* VALUE GRID */}
      <section className="px-6 py-20 border-t border-neutral-200">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-xl font-medium">
              Execution, Not Automation
            </h3>
            <p className="mt-4 text-sm text-neutral-600 leading-relaxed">
              OBAOL does not blindly send emails.
              Every layer — from inbox health to lead authenticity —
              is designed to protect deliverability and reputation.
            </p>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-xl font-medium">
              Built for Operators
            </h3>
            <p className="mt-4 text-sm text-neutral-600 leading-relaxed">
              Designed for founders, BD heads, SDR managers, and
              outbound operators who need predictable outcomes,
              not vanity metrics.
            </p>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-xl font-medium">
              System-Level Control
            </h3>
            <p className="mt-4 text-sm text-neutral-600 leading-relaxed">
              From warm-up pacing to sending limits, from reply
              classification to bounce intelligence —
              control exists at the system level.
            </p>
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="px-6 py-20 border-t border-neutral-200">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-semibold">
            Core Capabilities
          </h2>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              "Lead validation & hygiene enforcement",
              "Inbox warm-up with adaptive ramping",
              "Sending infrastructure & domain protection",
              "Reply detection & intent classification",
              "Bounce intelligence & auto-suppression",
              "Operator-level monitoring & controls",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 bg-white border border-neutral-200 rounded-xl p-5"
              >
                <span className="mt-1 h-2 w-2 rounded-full bg-black" />
                <p className="text-sm text-neutral-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POSITIONING BLOCK */}
      <section className="px-6 py-24 border-t border-neutral-200">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold leading-tight">
            This is not mass email.
            <br />
            This is outbound execution.
          </h2>

          <p className="mt-6 text-neutral-600 text-lg">
            OBAOL exists to replace fragile stacks,
            disconnected tools, and guesswork —
            with a single, disciplined execution layer.
          </p>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-neutral-200 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} OBAOL · Cold Email Marketing Infrastructure
      </footer>
    </div>
  );
}
