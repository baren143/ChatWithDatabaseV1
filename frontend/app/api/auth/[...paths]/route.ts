import { getBackendUrl } from "@/lib/backend-url";

async function proxyAuthRequest(request: Request) {
  try {
    const apiUrl = getBackendUrl();
    const url = new URL(request.url);
    const path = url.pathname.replace("/api/auth", "/auth");
    const method = request.method;

    const body = ["GET", "HEAD", "DELETE"].includes(method)
      ? undefined
      : await request.text().catch(() => undefined);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const authHeader = request.headers.get("Authorization");
    if (authHeader) headers["Authorization"] = authHeader;

    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body || undefined,
    });

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ detail: "Backend unreachable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(request: Request) { return proxyAuthRequest(request); }
export async function POST(request: Request) { return proxyAuthRequest(request); }
export async function PUT(request: Request) { return proxyAuthRequest(request); }
export async function DELETE(request: Request) { return proxyAuthRequest(request); }
