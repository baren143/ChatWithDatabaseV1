export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    // Forward to backend
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    let response: Response;
    try {
      response = await fetch("http://localhost:8000/api/upload", {
        method: "POST",
        headers: {
          "X-User-Id": "test_user_123",
        },
        body: backendFormData,
      });
    } catch (networkErr) {
      // Backend is not reachable (e.g. uvicorn not running)
      console.error("Cannot reach backend:", networkErr);
      return new Response(
        JSON.stringify({
          error: "Backend server is not running. Please start the FastAPI server on port 8000.",
        }),
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
  } catch (error) {
    console.error("Upload API error:", error);
    return new Response(`Error: ${String(error)}`, { status: 500 });
  }
}
