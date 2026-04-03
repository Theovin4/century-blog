import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.centurybloggs.com";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Century Blog | Lifestyle, Health, Education & Daily Gist",
    template: "%s | Century Blog"
  },
  description:
    "Century Blog is a modern Nigerian blog covering lifestyle, health, education, and daily gist with fast pages, rich stories, and strong SEO.",
  applicationName: "Century Blog",
  keywords: [
    "Century Blog",
    "Nigeria blog",
    "lifestyle blog",
    "health news Nigeria",
    "education news Nigeria",
    "daily gist Nigeria",
    "trending news Nigeria"
  ],
  authors: [{ name: "Century Blog" }],
  creator: "Century Blog",
  publisher: "Century Blog",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Century Blog",
    description:
      "A beautiful dark themed Nigerian blog for lifestyle, health, education, and daily gist.",
    url: siteUrl,
    siteName: "Century Blog",
    locale: "en_NG",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Century Blog",
    description:
      "A beautiful dark themed Nigerian blog for lifestyle, health, education, and daily gist."
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
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
