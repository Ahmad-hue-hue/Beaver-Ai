export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  try {
    const r = await fetch(`${API_URL}/api/v1/health/ready`, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'beaver-cron-keepalive' },
    });
    clearTimeout(timer);
    return Response.json({ ok: r.ok, status: r.status, ts: Date.now() });
  } catch {
    clearTimeout(timer);
    return Response.json({ ok: false, ts: Date.now() });
  }
}