import { getBackendUrl } from "@/lib/backend-url";

export async function GET() {
  let apiUrl: string;
  try {
    apiUrl = getBackendUrl();
  } catch {
    return new Response(
      JSON.stringify({ error: "Backend URL is not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/documents`, {
      headers: { "X-User-Id": "test_user_123" },
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
