import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API route handlers in app/api/* proxy to the FastAPI backend via BACKEND_URL
  // or NEXT_PUBLIC_API_URL (see lib/backend-url.ts).
};

export default nextConfig;
