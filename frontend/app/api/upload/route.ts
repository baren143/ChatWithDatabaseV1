import { getBackendUrl } from "@/lib/backend-url";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    let apiUrl: string;
    try {
      apiUrl = getBackendUrl();
    } catch {
      return new Response(
        JSON.stringify({ error: "Backend URL is not configured" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const backendFormData = new FormData();
    backendFormData.append("file", file);

    let response: Response;
    try {
      response = await fetch(`${apiUrl}/api/upload`, {
        method: "POST",
        headers: {
          "X-User-Id": "test_user_123",
        },
        body: backendFormData,
      });
    } catch {
      return new Response(
        JSON.stringify({ error: "Backend server is not reachable." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(`Upload failed: ${errorText}`, { status: response.status });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response("Upload request failed", { status: 500 });
  }
}
