import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default function robots() {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "Mediapartners-Google",
        allow: "/",
        disallow: ["/dashboard", "/api/"]
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api/"]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: new URL(siteUrl).host
  };
}
