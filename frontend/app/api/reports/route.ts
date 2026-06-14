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

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/reports', '/api/reports');
  
  const authHeader = request.headers.get('Authorization');
  const contentType = request.headers.get('Content-Type') || 'application/json';
  
  let body: string | FormData;
  if (contentType.includes('multipart')) {
    body = await request.formData();
  } else {
    body = await request.text();
  }

  let response: Response;
  try {
    response = await fetch(, {
      method: request.method,
      headers: {
        'Content-Type': contentType,
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body,
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

  // For file downloads, stream the response directly
  const responseContentType = response.headers.get('Content-Type') || 'application/octet-stream';
  const contentDisposition = response.headers.get('Content-Disposition');
  
  const headers: Record<string, string> = {
    'Content-Type': responseContentType,
  };
  if (contentDisposition) {
    headers['Content-Disposition'] = contentDisposition;
  }

  const data = await response.arrayBuffer();
  return new Response(data, { status: 200, headers });
}
