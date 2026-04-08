import { buildShareLinks } from "@/lib/site";

export function PostShareBar({ post }) {
  const shareLinks = buildShareLinks(post);

  return (
    <section className="post-share-panel section-card">
      <div>
        <span className="eyebrow">Share This Story</span>
        <h2>Share or follow Century Blog</h2>
      </div>
      <div className="post-share-grid">
        <a href={shareLinks.facebook} target="_blank" rel="noreferrer" className="social-link-chip">
          <span className="social-link-chip__badge">FB</span>
          <span>Share on Facebook</span>
        </a>
        <a href={shareLinks.x} target="_blank" rel="noreferrer" className="social-link-chip">
          <span className="social-link-chip__badge">X</span>
          <span>Share on X</span>
        </a>
        <a href={shareLinks.telegram} target="_blank" rel="noreferrer" className="social-link-chip">
          <span className="social-link-chip__badge">TG</span>
          <span>Share on Telegram</span>
        </a>
        <a href={shareLinks.pinterest} target="_blank" rel="noreferrer" className="social-link-chip">
          <span className="social-link-chip__badge">PT</span>
          <span>Save on Pinterest</span>
        </a>
      </div>
    </section>
  );
}
