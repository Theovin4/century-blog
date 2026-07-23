"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatLongDate, getCategoryMeta, getDisplayMedia, pickFeaturedPost, sortPostsByRecency } from "@/lib/site";

function hasPreferredHeroMedia(post) {
  const media = getDisplayMedia(post, "feature");
  return (media.kind === "image" || media.kind === "video") && !media.generated;
}

function buildRotationPool(posts) {
  const recentPosts = sortPostsByRecency(posts || []).slice(0, 5);

  if (!recentPosts.length) {
    return [];
  }

  const mediaReadyPosts = recentPosts.filter(hasPreferredHeroMedia);
  const fallbackPosts = recentPosts.filter((post) => !hasPreferredHeroMedia(post));
  const primaryPool = mediaReadyPosts.length ? mediaReadyPosts : recentPosts;
  const manuallyFeatured = primaryPool.find((post) => post.featured) || null;

  if (manuallyFeatured) {
    return [
      manuallyFeatured,
      ...primaryPool.filter((post) => post.slug !== manuallyFeatured.slug),
      ...fallbackPosts.filter((post) => post.slug !== manuallyFeatured.slug)
    ];
  }

  return mediaReadyPosts.length ? [...mediaReadyPosts, ...fallbackPosts] : recentPosts;
}

export function FeaturedStoryCarousel({ posts }) {
  const rotationPool = useMemo(() => buildRotationPool(posts), [posts]);
  const fallbackPost = useMemo(() => pickFeaturedPost(posts), [posts]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (rotationPool.length <= 1) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % rotationPool.length);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [rotationPool.length]);

  const safeIndex = rotationPool.length ? index % rotationPool.length : 0;
  const featuredPost = rotationPool[safeIndex] || fallbackPost;

  if (!featuredPost) {
    return null;
  }

  const featuredMedia = getDisplayMedia(featuredPost, "feature");
  const featuredHasImage = featuredMedia.kind === "image";
  const featuredHasVideo = featuredMedia.kind === "video";

  return (
    <article className={`feature-card ${featuredPost.coverStyle}`}>
      {featuredHasImage ? (
        <Image
          src={featuredMedia.url}
          alt={featuredPost.imageAlt || featuredPost.title}
          fill
          priority={!featuredMedia.generated}
          quality={78}
          sizes="(max-width: 980px) 100vw, 50vw"
          className="feature-card__image"
          unoptimized={featuredMedia.generated || String(featuredMedia.url || "").startsWith("data:")}
        />
      ) : null}
      {featuredHasVideo ? (
        <video
          className="feature-card__video"
          muted
          playsInline
          preload="none"
          poster={featuredMedia.posterUrl || undefined}
        >
          <source src={featuredMedia.url} type={featuredMedia.type} />
        </video>
      ) : null}
      <div className="feature-card__inner">
        <div className="feature-card__tags">
          <span className="pill">{getCategoryMeta(featuredPost.category).label}</span>
        </div>
        <p className="muted">
          {formatLongDate(featuredPost.publishedAt)} | {featuredPost.readTime}
        </p>
        <h2>{featuredPost.title}</h2>
        <p>{featuredPost.excerpt}</p>
        <Link href={`/news/${featuredPost.slug}`} className="text-link">
          Read full story
        </Link>
      </div>
    </article>
  );
}
