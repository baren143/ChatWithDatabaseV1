export async function GET() {
  let response: Response;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    
    // TODO: Replace hardcoded user ID with proper authentication
    // For now, we'll use a placeholder that should be replaced with real user ID from auth
    response = await fetch(`${apiUrl}/api/documents`, {
      headers: { "X-User-Id": "test_user_123" }, // This should come from authentication context
    });
  } catch (networkErr) {
    console.error("Cannot reach backend:", networkErr);
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
