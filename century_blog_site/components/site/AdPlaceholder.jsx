export function AdPlaceholder({ label = "Advertisement", variant = "default" }) {
  const showPlaceholder =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_SHOW_AD_PLACEHOLDERS === "true";

  if (!showPlaceholder) {
    return null;
  }

  return (
    <aside className={`ad-placeholder ad-placeholder--${variant}`} aria-label={label}>
      <span className="ad-placeholder__label">{label}</span>
      <p className="ad-placeholder__copy">
        Reserved for a future ad unit. Keep this area light, readable, and user-first.
      </p>
    </aside>
  );
}
