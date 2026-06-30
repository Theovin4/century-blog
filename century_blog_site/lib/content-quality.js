const NOINDEX_POST_SLUGS = new Set([
  "vote-for-journal-star-boys-athlete-of-the-week-may-18-23-how-nigerians-can-join-the-fun",
  "how-to-participate-in-go-fest-2026-with-a-pok-mon-go-spoofer",
  "vote-for-livingston-daily-athlete-of-the-week-may-18-23-2026-how-nigerians-can-join-the-countdown",
  "lauren-phillips-hits-afl-star-rory-lobb-with-x-rated-insult-off-air-then-gets-called-out-live-on-radio",
  "waikato-expressway-sh1-closed-southbound-from-te-kauwhata-after-serious-crash",
  "how-nascar-star-gutted-out-racing-on-broken-leg-5-things-about-dover-race"
]);

export function shouldNoIndexPost(postOrSlug) {
  const slug =
    typeof postOrSlug === "string"
      ? postOrSlug
      : String(postOrSlug?.slug || "").trim();

  return NOINDEX_POST_SLUGS.has(slug);
}

export function filterIndexablePosts(posts = []) {
  return posts.filter((post) => post?.slug && !shouldNoIndexPost(post));
}

export function getNoIndexPostSlugs() {
  return [...NOINDEX_POST_SLUGS];
}
