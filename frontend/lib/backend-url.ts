/**
 * Backend base URL for Next.js API route proxies.
 * BACKEND_URL is preferred on the server (e.g. internal Docker hostname).
 * NEXT_PUBLIC_API_URL is used as a fallback.
 */
export function getBackendUrl(): string {
  const url =
    process.env.BACKEND_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!url) {
    throw new Error(
      "Missing BACKEND_URL or NEXT_PUBLIC_API_URL. Set one in your environment."
    );
  }

  return url.replace(/\/$/, "");
}
