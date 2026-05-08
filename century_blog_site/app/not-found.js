import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";

export default function NotFound() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <span className="eyebrow">404</span>
        <h1>That page could not be found</h1>
        <p>
          The link may be outdated, the article may have moved, or the page may no longer be
          available. Use the links below to return to active sections of Century Blog.
        </p>
        <div className="editor-form__actions">
          <Link href="/" className="button button-primary">
            Back to homepage
          </Link>
          <Link href="/blog" className="button button-secondary">
            Browse latest stories
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
