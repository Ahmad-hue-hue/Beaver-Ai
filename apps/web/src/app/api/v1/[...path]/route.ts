export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Where the real API lives. Never NEXT_PUBLIC: this is server→server only, so
// the value (and the API key-scoped cookies) never reach the browser.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? 'https://beaver-api-97zs.onrender.com';

// Hop-by-hop headers the proxy must own, not pass through.
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'content-encoding',
]);

const ALLOWED_REQUEST_HEADERS = new Set([
  'authorization',
  'content-type',
  'cookie',
  'accept',
  'accept-language',
  'if-none-match',
  'if-modified-since',
]);

export async function handler(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const { search } = new URL(req.url);

  // The page origin the API's Set-Cookie headers must be rewritten to. The
  // browser rejects cookies whose Domain doesn't match the current host, so the
  // upstream refresh_token cookie is scoped to THIS host instead.
  const host = req.headers.get('host') ?? 'localhost:3000';
  const originHost = host.split(':')[0];

  const headers = new Headers();
  for (const [k, v] of req.headers) {
    if (ALLOWED_REQUEST_HEADERS.has(k.toLowerCase())) headers.set(k, v);
  }
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');

  const upstream = await fetch(
    `${INTERNAL_API_URL}/api/v1/${path.join('/')}${search}`,
    {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
    },
  );

  const resHeaders = new Headers();
  for (const [k, v] of upstream.headers) {
    const lk = k.toLowerCase();
    if (HOP_BY_HOP.has(lk)) continue;
    if (lk === 'set-cookie') continue;
    resHeaders.set(k, v);
  }

  for (const cookie of upstream.headers.getSetCookie()) {
    resHeaders.append(
      'set-cookie',
      cookie
        .replace(/Domain=[^;]+/i, `Domain=${originHost}`)
        .replace(/SameSite=(None|Strict)/i, 'SameSite=Lax'),
    );
  }

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: resHeaders,
  });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS, handler as HEAD };