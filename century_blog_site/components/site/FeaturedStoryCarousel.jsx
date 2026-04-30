"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatLongDate, getCategoryMeta, getDisplayMedia, pickFeaturedPost, sortPostsByRecency } from "@/lib/site";

function buildRotationPool(posts) {
  const recentPosts = sortPostsByRecency(posts || []).slice(0, 5);

  if (!recentPosts.length) {
    return [];
  }

  const manuallyFeatured = recentPosts.find((post) => post.featured) || null;

  if (manuallyFeatured) {
    return [manuallyFeatured, ...recentPosts.filter((post) => post.slug !== manuallyFeatured.slug)];
  }

  return recentPosts;
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

  const featuredMedia = getDisplayMedia(featuredPost, "feature");
  const featuredHasImage = featuredMedia.kind === "image";
  const featuredHasVideo = featuredMedia.kind === "video";

  return (
    <article className={`feature-card ${featuredPost.coverStyle}`}>
      {featuredHasImage ? (
        <img
          src={featuredMedia.url}
          alt={featuredPost.title}
          className="feature-card__image"
          fetchPriority="high"
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
