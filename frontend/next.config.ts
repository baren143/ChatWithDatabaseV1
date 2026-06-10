import type { NextConfig } from "next";

const nextConfig: NextConfig = {
 // API route handlers in app/api/* proxy to the FastAPI backend via BACKEND_URL
 // or NEXT_PUBLIC_API_URL (see lib/backend-url.ts).
 devIndicators: false,
 turbopack: {},
 allowedDevOrigins: ['187.127.178.25'],
 webpack: (config, { isServer }) => {
 config.watchOptions = config.watchOptions || {};
 config.watchOptions.ignored = [
 ...((config.watchOptions.ignored as string[]) || []),
 "**/backend/**",
 "**/backend/uploads/**",
 ];
 return config;
 },
};

export default nextConfig;
