"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatLongDate, getCategoryMeta, isImageMedia, isVideoMedia, pickFeaturedPost, prioritizePosts } from "@/lib/site";

function buildRotationPool(posts) {
  const prioritized = prioritizePosts(posts || []);
  if (!prioritized.length) {
    return [];
  }

  const manuallyFeatured = prioritized.find((post) => post.featured) || null;
  const mediaFirst = prioritized.filter(
    (post) => isImageMedia(post.mediaUrl, post.mediaType) || isVideoMedia(post.mediaUrl, post.mediaType)
  );
  const poolBase = mediaFirst.length ? mediaFirst : prioritized;
  const trimmed = poolBase.slice(0, 5);

  if (manuallyFeatured) {
    return [manuallyFeatured, ...trimmed.filter((post) => post.slug !== manuallyFeatured.slug)];
  }

  return trimmed;
}

export function FeaturedStoryCarousel({ posts }) {
  const rotationPool = useMemo(() => buildRotationPool(posts), [posts]);
  const fallbackPost = useMemo(() => pickFeaturedPost(posts), [posts]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [rotationPool.length]);

  useEffect(() => {
    if (rotationPool.length <= 1) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % rotationPool.length);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [rotationPool.length]);

  const featuredPost = rotationPool[index] || fallbackPost;

  if (!featuredPost) {
    return null;
  }

  const featuredHasImage = isImageMedia(featuredPost.mediaUrl, featuredPost.mediaType);
  const featuredHasVideo = isVideoMedia(featuredPost.mediaUrl, featuredPost.mediaType);

  return (
    <article className={`feature-card ${featuredPost.coverStyle}`}>
      {featuredHasImage ? (
        <img
          src={featuredPost.mediaUrl}
          alt={featuredPost.title}
          className="feature-card__image"
          fetchPriority="high"
        />
      ) : null}
      {featuredHasVideo ? (
        <video
          className="feature-card__video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={featuredPost.posterUrl || undefined}
        >
          <source src={featuredPost.mediaUrl} type={featuredPost.mediaType} />
        </video>
      ) : null}
      <div className="feature-card__inner">
        <div className="feature-card__tags">
          <span className="pill">{getCategoryMeta(featuredPost.category).label}</span>
          <span className={`pill pill-type pill-type--${featuredPost.type || "manual"}`}>
            {(featuredPost.type || "manual").toUpperCase()}
          </span>
          {rotationPool.length > 1 ? <span className="pill">Rotates every 30s</span> : null}
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
