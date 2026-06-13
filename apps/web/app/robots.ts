import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "../lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/internal/analytics"
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/"
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/"
      },
      {
        userAgent: "GPTBot",
        allow: "/"
      },
      {
        userAgent: "Googlebot",
        allow: "/"
      },
      {
        userAgent: "Bingbot",
        allow: "/"
      },
      {
        userAgent: "*",
        allow: "/"
      }
    ],
    sitemap: new URL("/sitemap.xml", baseUrl).toString()
  };
}
