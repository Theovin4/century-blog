import { getSiteUrl } from "@/lib/site";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api/"]
      }
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
    host: getSiteUrl()
  };
}
