import Link from "next/link";
import { getSubstackUrl } from "@/lib/site";
import { SocialLinks } from "@/components/site/SocialLinks";

export function SiteFooter() {
  const substackUrl = getSubstackUrl();

  return (
    <footer className="site-footer">
      <SocialLinks compact title="Follow Century Blog everywhere" />
      <div className="footer-links">
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy-policy">Privacy Policy</Link>
        {substackUrl ? (
          <a href={substackUrl} target="_blank" rel="noreferrer">
            Substack
          </a>
        ) : null}
      </div>
    </footer>
  );
}
