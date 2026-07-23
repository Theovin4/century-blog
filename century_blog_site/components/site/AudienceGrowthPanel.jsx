import Link from "next/link";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { SocialLinks } from "@/components/site/SocialLinks";

function isExternalUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

export function AudienceGrowthPanel({
  eyebrow = "Century Briefing",
  title,
  description,
  actions = [],
  showNewsletter = true,
  showSocial = false,
  note = ""
}) {
  return (
    <section className={`audience-panel section-card ${showNewsletter ? "audience-panel--with-form" : ""}`}>
      <div className="audience-panel__copy">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p className="hero-text">{description}</p>
        {actions.length ? (
          <div className="audience-panel__actions">
            {actions.map((action) =>
              isExternalUrl(action.href) ? (
                <a
                  key={`${action.label}-${action.href}`}
                  href={action.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`button ${action.variant === "secondary" ? "button-secondary" : "button-primary"}`}
                >
                  {action.label}
                </a>
              ) : (
                <Link
                  key={`${action.label}-${action.href}`}
                  href={action.href}
                  className={`button ${action.variant === "secondary" ? "button-secondary" : "button-primary"}`}
                >
                  {action.label}
                </Link>
              )
            )}
          </div>
        ) : null}
        {note ? <p className="audience-panel__note">{note}</p> : null}
        {showSocial ? <SocialLinks compact /> : null}
      </div>
      {showNewsletter ? (
        <div className="audience-panel__form">
          <NewsletterForm />
        </div>
      ) : null}
    </section>
  );
}
