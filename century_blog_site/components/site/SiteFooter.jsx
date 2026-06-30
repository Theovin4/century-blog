import Link from "next/link";
import { getSubstackUrl } from "@/lib/site";
import { SocialLinks } from "@/components/site/SocialLinks";

export function SiteFooter({ showSocial = true }) {
  const substackUrl = getSubstackUrl();

  return (
    <footer className="site-footer">
      {showSocial ? <SocialLinks compact /> : null}
      <div className="footer-links">
        <Link href="/">Home</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/editorial-policy">Editorial Policy</Link>
        <Link href="/corrections-policy">Corrections Policy</Link>
        <Link href="/advertise">Advertise</Link>
        <Link href="/disclaimer">Disclaimer</Link>
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/cookie-policy">Cookie Policy</Link>
        <Link href="/sitemap.xml">Sitemap</Link>
        {substackUrl ? (
          <a href={substackUrl} target="_blank" rel="noreferrer">
            Substack
          </a>
        ) : null}
      </div>
    </footer>
  );
}
