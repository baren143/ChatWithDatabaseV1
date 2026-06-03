export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body.message || "";
    const document_ids: string[] | undefined = body.document_ids;

    if (!message) {
      return new Response("No message provided", { status: 400 });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    
    // TODO: Replace hardcoded user ID with proper authentication
    // For now, we'll use a placeholder that should be replaced with real user ID from auth
    const userId = "test_user_123"; // This should come from authentication context

    let response: Response;
    try {
      response = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        // Forward document_ids so the backend scopes the vector search
        // to exactly the documents the user uploaded this session.
        body: JSON.stringify({ message, document_ids }),
      });
    } catch (networkErr) {
      console.error("Cannot reach backend:", networkErr);
      return new Response(
        "Backend server is not running. Please start the FastAPI server on port 8000.",
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(`Backend error: ${errorText}`, { status: response.status });
    }

    // Return the streaming response
    if (response.body) {
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    return new Response("No response body", { status: 500 });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(`Error: ${String(error)}`, { status: 500 });
  }
}
