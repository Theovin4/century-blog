import { socialLinks } from "@/lib/site";

export function SocialLinks({ title = "Follow Century Blog", compact = false }) {
  return (
    <section className={`social-panel ${compact ? "social-panel--compact" : ""}`}>
      <div>
        <span className="eyebrow">Stay Connected</span>
        <h2>{title}</h2>
      </div>
      <div className="social-links-grid">
        {socialLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="social-link-chip"
            target="_blank"
            rel="noreferrer"
          >
            <span className="social-link-chip__badge">{link.shortLabel}</span>
            <span>{link.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
