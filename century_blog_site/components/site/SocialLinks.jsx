import { socialLinks } from "@/lib/site";

function Icon({ name }) {
  switch (name) {
    case "Facebook":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="social-link-chip__icon-svg">
          <path fill="currentColor" d="M13.5 21v-7h2.3l.4-3h-2.7V9.1c0-.9.3-1.6 1.6-1.6H16V4.8c-.6-.1-1.4-.2-2.3-.2-2.3 0-3.8 1.4-3.8 4V11H7.5v3h2.4v7h3.6Z" />
        </svg>
      );
    case "Instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="social-link-chip__icon-svg">
          <path fill="currentColor" d="M7.8 3h8.4A4.8 4.8 0 0 1 21 7.8v8.4a4.8 4.8 0 0 1-4.8 4.8H7.8A4.8 4.8 0 0 1 3 16.2V7.8A4.8 4.8 0 0 1 7.8 3Zm0 1.8A3 3 0 0 0 4.8 7.8v8.4a3 3 0 0 0 3 3h8.4a3 3 0 0 0 3-3V7.8a3 3 0 0 0-3-3H7.8Zm8.85 1.35a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1ZM12 7.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5Zm0 1.8A2.7 2.7 0 1 0 14.7 12 2.7 2.7 0 0 0 12 9.3Z" />
        </svg>
      );
    case "X":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="social-link-chip__icon-svg">
          <path fill="currentColor" d="M18.9 3H21l-6.9 7.9 8.1 10.1h-6.4l-5-6.2L5.4 21H3.3l7.4-8.4L3 3h6.6l4.5 5.7L18.9 3Zm-1.1 16.1h1.2L8.9 4.8H7.6l10.2 14.3Z" />
        </svg>
      );
    case "TikTok":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="social-link-chip__icon-svg">
          <path fill="currentColor" d="M14.6 3c.2 1.5 1.1 2.8 2.4 3.6.8.5 1.7.8 2.7.8V10a7.3 7.3 0 0 1-3.3-.8v5.7a5.9 5.9 0 1 1-5.1-5.8v2.8a3.1 3.1 0 1 0 2.3 3V3h3Z" />
        </svg>
      );
    case "YouTube":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="social-link-chip__icon-svg">
          <path fill="currentColor" d="M21.6 7.2a2.9 2.9 0 0 0-2.1-2c-1.8-.5-7.5-.5-7.5-.5s-5.7 0-7.5.5a2.9 2.9 0 0 0-2.1 2A30.4 30.4 0 0 0 2 12a30.4 30.4 0 0 0 .4 4.8 2.9 2.9 0 0 0 2.1 2c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a2.9 2.9 0 0 0 2.1-2A30.4 30.4 0 0 0 22 12a30.4 30.4 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
        </svg>
      );
    case "Pinterest":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="social-link-chip__icon-svg">
          <path fill="currentColor" d="M12 3a9 9 0 0 0-3.3 17.4c0-.7 0-1.8.4-2.6l1.2-5.1s-.3-.7-.3-1.7c0-1.5.9-2.7 2-2.7 1 0 1.4.7 1.4 1.6 0 1-.6 2.4-.9 3.8-.2 1.1.6 2 1.8 2 2.1 0 3.5-2.6 3.5-5.7 0-2.3-1.5-4.1-4.4-4.1a5 5 0 0 0-5.2 5c0 .9.2 1.6.6 2.1.2.2.2.3.1.6l-.2.9c0 .3-.3.4-.6.3-1.6-.6-2.3-2.2-2.3-4 0-3 2.5-6.5 7.4-6.5 4 0 6.6 2.9 6.6 5.9 0 4.1-2.3 7.1-5.8 7.1-1.2 0-2.3-.6-2.7-1.4l-.7 2.6c-.3 1-.8 2-1.3 2.8.8.2 1.7.4 2.6.4A9 9 0 0 0 12 3Z" />
        </svg>
      );
    case "Telegram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="social-link-chip__icon-svg">
          <path fill="currentColor" d="M20.7 4.2 3.8 10.8c-1.2.5-1.2 1.2-.2 1.5l4.3 1.3 1.7 5.2c.2.6.1.8.8.8.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8l2.9-13.6c.3-1.2-.4-1.7-1.1-1.4ZM9.6 18.2l-1.2-4 9.8-6.2c.5-.3 1-.1.6.3l-8.2 7.4-.3 2.5-.7-.1Z" />
        </svg>
      );
    default:
      return null;
  }
}

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
            <span className="social-link-chip__icon">
              <Icon name={link.label} />
            </span>
            <span>{link.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
