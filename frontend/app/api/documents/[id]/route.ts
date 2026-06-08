import { getBackendUrl } from "@/lib/backend-url";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let apiUrl: string;
  try {
    apiUrl = getBackendUrl();
  } catch {
    return new Response(
      JSON.stringify({ error: "Backend URL is not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Forward the Authorization header from the incoming request
  const authHeader = request.headers.get("Authorization");

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/documents/${id}`, {
      headers: {
        // Forward the Authorization header if present
        ...(authHeader ? { "Authorization": authHeader } : {}),
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Backend not reachable" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let apiUrl: string;
  try {
    apiUrl = getBackendUrl();
  } catch {
    return new Response(
      JSON.stringify({ error: "Backend URL is not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Forward the Authorization header from the incoming request
  const authHeader = request.headers.get("Authorization");

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/documents/${id}`, {
      method: "DELETE",
      headers: {
        // Forward the Authorization header if present
        ...(authHeader ? { "Authorization": authHeader } : {}),
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Backend not reachable" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}