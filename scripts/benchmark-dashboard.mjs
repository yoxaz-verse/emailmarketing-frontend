const baseUrl = String(process.env.BENCHMARK_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const cookie = String(process.env.BENCHMARK_COOKIE || '');
const samples = Math.max(3, Number(process.env.BENCHMARK_SAMPLES || 20));
const paths = (process.env.BENCHMARK_PATHS || '/dashboard,/dashboard/leads,/dashboard/campaign')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function percentile(values, fraction) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))];
}

for (const path of paths) {
  const timings = [];
  const sizes = [];
  const outcomes = { success: 0, redirect: 0, backend_failure: 0, error: 0 };
  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${path}`, {
      headers: cookie ? { cookie } : {},
      redirect: 'manual',
    });
    const body = await response.arrayBuffer();
    const duration = performance.now() - startedAt;
    if (response.status >= 300 && response.status < 400) outcomes.redirect += 1;
    else if ([502, 503, 504].includes(response.status)) outcomes.backend_failure += 1;
    else if (response.ok) outcomes.success += 1;
    else outcomes.error += 1;
    if (response.ok) timings.push(duration);
    sizes.push(body.byteLength);
  }
  process.stdout.write(`${JSON.stringify({
    path,
    samples,
    authenticated: Boolean(cookie),
    outcomes,
    p50_ms: timings.length ? Math.round(percentile(timings, 0.5)) : null,
    p95_ms: timings.length ? Math.round(percentile(timings, 0.95)) : null,
    average_bytes: Math.round(sizes.reduce((sum, value) => sum + value, 0) / sizes.length),
  })}\n`);
}
