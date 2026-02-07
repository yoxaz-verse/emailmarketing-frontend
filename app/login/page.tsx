
export default async function LoginPage() {


  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-neutral-950 text-white">
      {/* LEFT BRAND PANEL */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-neutral-900 via-neutral-900 to-black">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">OBAOL</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Cold Email Marketing · Execution Infrastructure
          </p>
        </div>

        <div className="max-w-md">
          <h2 className="text-4xl font-semibold leading-tight">
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

        <p className="text-xs text-neutral-600">
          © {new Date().getFullYear()} OBAOL. All rights reserved.
        </p>
      </div>

      {/* RIGHT LOGIN PANEL */}
      <div className="flex items-center justify-center px-6 bg-neutral-50 text-black">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-neutral-200">

          {/* {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )} */}

          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Sign in to OBAOL
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Access your cold email execution dashboard
            </p>
          </div>

          <form
            method="post"
            action="/api/auth/login"
            className="space-y-5"
          >
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Email address
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@company.com"
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <div className="flex items-center justify-end">
              <a
                href="/forgot-password"
                className="text-xs text-neutral-500 hover:text-black transition"
              >
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-black py-2.5 text-white text-sm font-medium hover:bg-neutral-900 transition"
            >
              Sign in
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-neutral-500">
            This is not a mass email tool.
            <br />
            This is outbound infrastructure.
          </div>
        </div>
      </div>
    </div>
  );
}
