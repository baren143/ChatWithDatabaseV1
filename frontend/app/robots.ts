import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://chat-with-db.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/features", "/demo", "/tech"],
        disallow: ["/api/", "/app/", "/auth/"],
      },
      {
        userAgent: "GPTBot",
        disallow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
