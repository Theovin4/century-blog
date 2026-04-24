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
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/terms-and-conditions">Terms and Conditions</Link>
        <Link href="/cookies-policy">Cookies Policy</Link>
        {substackUrl ? (
          <a href={substackUrl} target="_blank" rel="noreferrer">
            Substack
          </a>
        ) : null}
      </div>
    </footer>
  );
}
