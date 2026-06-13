import { getBackendUrl } from "@/lib/backend-url";

export async function GET(request: Request) {
  let apiUrl: string;
  try {
    apiUrl = getBackendUrl();
  } catch {
    return Response.json({ total: 0, items: [] }, { status: 200 });
  }

  const authHeader = request.headers.get("Authorization");

  try {
    const response = await fetch(`${apiUrl}/api/documents`, {
      headers: {
        ...(authHeader ? { "Authorization": authHeader } : {}),
      },
    });

    if (!response.ok) {
      return Response.json({ total: 0, items: [] }, { status: 200 });
    }

    const data = await response.json();
    return Response.json(data, { status: 200 });
  } catch (err) {
    console.error("Document proxy error:", err);
    return Response.json({ total: 0, items: [] }, { status: 200 });
  }
}
