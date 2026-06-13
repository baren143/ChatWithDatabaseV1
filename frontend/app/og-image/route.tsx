import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          padding: "60px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo area */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #00b4d8, #0077b6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: "bold",
              color: "white",
            }}
          >
            C
          </div>
          <span style={{ fontSize: "28px", fontWeight: "bold", color: "white" }}>ChatWithDB</span>
        </div>

        {/* Main headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "30px" }}>
          <h1
            style={{
              fontSize: "64px",
              fontWeight: "800",
              color: "white",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Talk to Your Documents
          </h1>
          <h1
            style={{
              fontSize: "64px",
              fontWeight: "800",
              color: "white",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            & Databases Using AI
          </h1>
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "26px",
            color: "#90e0ef",
            margin: 0,
            marginBottom: "40px",
            opacity: 0.9,
          }}
        >
          Upload PDFs, CSVs, Excel files — Ask questions. Get cited answers.
        </p>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "auto" }}>
          {["RAG-Powered", "Natural Language SQL", "Verified Citations"].map((text) => (
            <div
              key={text}
              style={{
                padding: "16px 32px",
                borderRadius: "32px",
                background: "rgba(0, 180, 216, 0.15)",
                fontSize: "20px",
                color: "#00b4d8",
                fontWeight: "600",
              }}
            >
              {text}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: "24px",
            color: "rgba(144, 224, 239, 0.6)",
            fontSize: "16px",
          }}
        >
          <span>chat-with-db.com</span>
          <span>Vector Search • pgvector • NVIDIA NIM</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
