export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let response: Response;
  try {
    response = await fetch(`http://localhost:8000/api/documents/${id}`, {
      headers: { "X-User-Id": "test_user_123" },
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let response: Response;
  try {
    response = await fetch(`http://localhost:8000/api/documents/${id}`, {
      method: "DELETE",
      headers: { "X-User-Id": "test_user_123" },
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
