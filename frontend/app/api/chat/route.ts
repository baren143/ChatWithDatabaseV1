import { getBackendUrl } from "@/lib/backend-url";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body.message || "";
    const document_ids: string[] | undefined = body.document_ids;
    const history = body.history;

    if (!message) {
      return new Response("No message provided", { status: 400 });
    }

    let apiUrl: string;
    try {
      apiUrl = getBackendUrl();
    } catch {
      return new Response("Backend URL is not configured", { status: 503 });
    }

    const userId = "test_user_123";

    let response: Response;
    try {
      response = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify({ message, document_ids, history }),
      });
    } catch {
      return new Response("Backend server is not reachable.", { status: 503 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(`Backend error: ${errorText}`, { status: response.status });
    }

    if (response.body) {
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    return new Response("No response body", { status: 500 });
  } catch {
    return new Response("Chat request failed", { status: 500 });
  }
}
