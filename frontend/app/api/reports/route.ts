import { getBackendUrl } from '@/lib/backend-url';

export async function POST(request: Request) {
  let apiUrl: string;
  try {
    apiUrl = getBackendUrl();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Backend URL is not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const path = request.url.replace(/.*\/api\/reports/, '/api/reports');
  const authHeader = request.headers.get('Authorization');
  const body = await request.text();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  let response: Response;
  try {
    response = await fetch(apiUrl + path, {
      method: 'POST',
      headers: headers,
      body: body,
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Backend server is not reachable.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(errorText, { status: response.status });
  }

  const ct = response.headers.get('Content-Type') || 'application/octet-stream';
  const cd = response.headers.get('Content-Disposition');
  const respHeaders: Record<string, string> = { 'Content-Type': ct };
  if (cd) {
    respHeaders['Content-Disposition'] = cd;
  }

  const data = await response.arrayBuffer();
  return new Response(data, { status: 200, headers: respHeaders });
}
