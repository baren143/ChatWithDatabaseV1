import { getBackendUrl } from "@/lib/backend-url";

export async function GET(request: Request) {
  let apiUrl: string;
  try {
    apiUrl = getBackendUrl();
  } catch {
    return new Response(
      JSON.stringify({ error: "Backend URL is not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const authHeader = request.headers.get("Authorization");

  try {
    const response = await fetch(`${apiUrl}/api/documents`, {
      headers: {
        ...(authHeader ? { "Authorization": authHeader } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Document proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Backend not reachable", detail: String(err) }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
