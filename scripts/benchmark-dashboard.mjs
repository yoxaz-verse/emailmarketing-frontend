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
  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${path}`, {
      headers: cookie ? { cookie } : {},
      redirect: 'manual',
    });
    const body = await response.arrayBuffer();
    if (response.status >= 400) throw new Error(`${path} returned ${response.status}`);
    timings.push(performance.now() - startedAt);
    sizes.push(body.byteLength);
  }
  process.stdout.write(`${JSON.stringify({
    path,
    samples,
    p50_ms: Math.round(percentile(timings, 0.5)),
    p95_ms: Math.round(percentile(timings, 0.95)),
    average_bytes: Math.round(sizes.reduce((sum, value) => sum + value, 0) / sizes.length),
  })}\n`);
}
