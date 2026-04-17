import Script from "next/script";
import "./globals.css";
import { socialLinks } from "@/lib/site";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://centuryblogg.vercel.app";
const gaId = process.env.NEXT_PUBLIC_GA_ID;

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Century Blog | Breaking Nigerian News, Global Stories & Real-Time Updates",
    template: "%s | Century Blog"
  },
  description:
    "Century Blog delivers breaking Nigerian news, global stories, and real-time updates across business, tech, health, sports, entertainment, lifestyle, education, and daily gist.",
  applicationName: "Century Blog",
  keywords: [
    "Century Blog",
    "Nigeria news",
    "breaking Nigerian news",
    "global stories",
    "business news Nigeria",
    "tech news Nigeria",
    "health news Nigeria",
    "sports news Nigeria",
    "entertainment news Nigeria"
  ],
  authors: [{ name: "Century Blog" }],
  creator: "Century Blog",
  publisher: "Century Blog",
  category: "news",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Century Blog",
    description:
      "Breaking Nigerian news, global stories, and real-time updates across business, tech, health, sports, and entertainment.",
    url: siteUrl,
    siteName: "Century Blog",
    locale: "en_NG",
    type: "website",
    images: [
      {
        url: `${siteUrl}/century-blog-logo.png`,
        width: 768,
        height: 768,
        alt: "Century Blog logo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Century Blog",
    description:
      "Breaking Nigerian news, global stories, and real-time updates across business, tech, health, sports, and entertainment.",
    images: [`${siteUrl}/century-blog-logo.png`]
  },
  icons: {
    icon: "/century-blog-logo.png",
    shortcut: "/century-blog-logo.png",
    apple: "/century-blog-logo.png"
  },
  other: {
    "google-adsense-account": "ca-pub-1037358753872630",
    "google-site-verification": "KkO1C4c8bxgmEBRKYl-EOspUpwfBT4yustVIkEu9pIE"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  }
};

export default function RootLayout({ children }) {
  const organizationId = `${siteUrl}#organization`;
  const websiteId = `${siteUrl}#website`;
  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "@id": organizationId,
    name: "Century Blog",
    url: siteUrl,
    logo: `${siteUrl}/century-blog-logo.png`,
    publishingPrinciples: `${siteUrl}/about`,
    ethicsPolicy: `${siteUrl}/about`,
    correctionsPolicy: `${siteUrl}/contact`,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${siteUrl}/contact`,
      availableLanguage: ["English"]
    },
    sameAs: socialLinks.map((link) => link.href)
  };
  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId,
    url: siteUrl,
    name: "Century Blog",
    publisher: {
      "@id": organizationId
    },
    inLanguage: "en-NG",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang="en">
      <body>
        <Script
          id="google-adsense"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1037358753872630"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        {gaId ? (
          <>
            <Script
              id="google-analytics"
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics-config" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${gaId}', { anonymize_ip: true });`}
            </Script>
          </>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationLd, websiteLd]) }}
        />
        {children}
      </body>
    </html>
  );
}
