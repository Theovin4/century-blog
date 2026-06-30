/** @type {import('next').NextConfig} */
const defaultSiteUrl = "https://www.centuryblog.com.ng";
const redirectSiteUrl = "https://centuryblog.com.ng";
const legacyRedirectHosts = ["centuryblogg.vercel.app", "centuryblog.vercel.app"];
const publicRedirectSources = [
  "/",
  "/blog",
  "/about",
  "/contact",
  "/advertise",
  "/disclaimer",
  "/privacy-policy",
  "/terms",
  "/terms-and-conditions",
  "/cookie-policy",
  "/cookies-policy",
  "/editorial-policy",
  "/corrections-policy",
  "/sitemap.xml",
  "/news-sitemap.xml",
  "/robots.txt",
  "/ads.txt",
  "/category/:path*",
  "/news/:path*"
];

function getConfiguredSiteHostname() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || defaultSiteUrl).hostname;
  } catch {
    return new URL(defaultSiteUrl).hostname;
  }
}

const configuredHostnames = Array.from(
  new Set([new URL(defaultSiteUrl).hostname, new URL(redirectSiteUrl).hostname, getConfiguredSiteHostname()].filter(Boolean))
);

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()"
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin"
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-site"
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off"
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none"
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1"
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload"
  }
];

const nextConfig = {
  experimental: {
    viewTransition: true,
    workerThreads: true
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com"
      },
      ...configuredHostnames.map((hostname) => ({
        protocol: "https",
        hostname
      }))
    ]
  },
  async redirects() {
    return legacyRedirectHosts.flatMap((host) =>
      publicRedirectSources.map((source) => ({
        source,
        has: [{ type: "host", value: host }],
        destination: `${defaultSiteUrl}${source === "/" ? "" : source}`,
        permanent: true
      }))
    );
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
