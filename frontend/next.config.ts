import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: The rewrites block has been intentionally removed.
  // We have dedicated Next.js API route handlers at:
  //   app/api/upload/route.ts  →  proxies to http://localhost:8000/api/upload
  //   app/api/chat/route.ts    →  proxies to http://localhost:8000/api/chat
  //
  // Keeping rewrites alongside route handlers caused a routing conflict where
  // Next.js would match the rewrite AFTER the route handler already handled it,
  // resulting in double-proxy chains and unpredictable behaviour.
};

export default nextConfig;
