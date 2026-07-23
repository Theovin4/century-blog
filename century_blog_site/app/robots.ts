import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();
const siteHost = new URL(siteUrl).host;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/dashboard/", "/api", "/api/"]
      }
    ],
    host: siteHost,
    sitemap: [`${siteUrl}/sitemap.xml`, `${siteUrl}/news-sitemap.xml`]
  };
}
