"use client";

import { useEffect, useMemo, useState } from "react";

const likedPostsKey = "centuryblogg-liked-posts";

function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="engagement-icon">
      <path
        d="M12 21.35 10.55 20C5.4 15.24 2 12.09 2 8.25 2 5.1 4.42 2.75 7.5 2.75c1.74 0 3.41.81 4.5 2.09 1.09-1.28 2.76-2.09 4.5-2.09 3.08 0 5.5 2.35 5.5 5.5 0 3.84-3.4 6.99-8.55 11.76L12 21.35Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="engagement-icon">
      <path
        d="M5 18.5V6.75C5 5.78 5.78 5 6.75 5h10.5C18.22 5 19 5.78 19 6.75v7.5c0 .97-.78 1.75-1.75 1.75H9.5L5 18.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatCommentDate(value) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function getVisitorId() {
  if (typeof window === "undefined") {
    return "";
  }

  const key = "centuryblogg-visitor-id";
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const generated = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(key, generated);
  return generated;
}

function getLikedPosts() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(likedPostsKey);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLikedPost(slug) {
  const likedPosts = new Set(getLikedPosts());
  likedPosts.add(slug);
  window.localStorage.setItem(likedPostsKey, JSON.stringify([...likedPosts]));
}

function dedupeComments(comments) {
  const seen = new Set();

  return comments.filter((comment) => {
    const key = `${comment.id || ""}:${comment.createdAt || ""}:${comment.message || ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function mergeEngagementState(previous, incoming, fallbackComment = null) {
  const next = incoming || {};
  const previousComments = Array.isArray(previous?.comments) ? previous.comments : [];
  let incomingComments = Array.isArray(next.comments) ? next.comments : [];

  if (!incomingComments.length && fallbackComment) {
    incomingComments = [...previousComments, fallbackComment];
  }

  const comments = dedupeComments(
    incomingComments.length >= previousComments.length
      ? incomingComments
      : previousComments
  );

  return {
    slug: next.slug || previous?.slug || "",
    likes: Math.max(
      typeof next.likes === "number" ? next.likes : 0,
      typeof previous?.likes === "number" ? previous.likes : 0
    ),
    comments
  };
}

export function PostEngagement({ slug, initialEngagement }) {
  const [engagement, setEngagement] = useState(initialEngagement || { slug, likes: 0, comments: [] });
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentMessage, setCommentMessage] = useState("");
  const [commentError, setCommentError] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    setEngagement(initialEngagement || { slug, likes: 0, comments: [] });
    setLiked(getLikedPosts().includes(slug));

    async function syncEngagement() {
      try {
        const response = await fetch(`/api/engagement/${slug}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const latest = await response.json();

        if (!active) {
          return;
        }

        setEngagement((current) => mergeEngagementState(current, latest));
      } catch {
        // Keep current UI state if the refresh fails.
      }
    }

    syncEngagement();

    return () => {
      active = false;
    };
  }, [slug, initialEngagement]);

  const commentCountLabel = useMemo(() => {
    const count = engagement.comments.length;
    return count === 1 ? "1 comment" : `${count} comments`;
  }, [engagement.comments.length]);

  async function handleLike() {
    if (likeBusy || liked) {
      return;
    }

    setLikeBusy(true);
    setCommentError("");

    try {
      const response = await fetch(`/api/engagement/${slug}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ visitorId: getVisitorId() })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to like this post right now.");
      }

      setEngagement((current) => mergeEngagementState(current, data.engagement));
      setLiked(true);
      saveLikedPost(slug);
    } catch (error) {
      setCommentError(error.message || "Unable to like this post right now.");
    } finally {
      setLikeBusy(false);
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();
    setCommentError("");
    setCommentMessage("");

    if (!name.trim() || !message.trim()) {
      setCommentError("Please enter your name and comment.");
      return;
    }

    setCommentBusy(true);

    try {
      const response = await fetch(`/api/engagement/${slug}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim(),
          message: message.trim()
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to post comment right now.");
      }

      setEngagement((current) => mergeEngagementState(current, data.engagement, data.comment));
      setName("");
      setMessage("");
      setCommentMessage("Comment posted. Thanks for joining the conversation.");
    } catch (error) {
      setCommentError(error.message || "Unable to post comment right now.");
    } finally {
      setCommentBusy(false);
    }
  }

  return (
    <section className="engagement-panel" aria-label="Post engagement">
      <div className="engagement-panel__header">
        <div>
          <span className="eyebrow">Join the conversation</span>
          <h2>React and comment on this story</h2>
          <p>Drop a quick like or leave a thoughtful comment to keep the discussion lively.</p>
        </div>
        <div className="engagement-panel__stats">
          <span className="engagement-stat">
            <HeartIcon filled />
            {engagement.likes} likes
          </span>
          <span className="engagement-stat">
            <MessageIcon />
            {commentCountLabel}
          </span>
        </div>
      </div>

      <div className="engagement-actions">
        <button
          type="button"
          className={`engagement-like-button${liked ? " is-liked" : ""}`}
          onClick={handleLike}
          disabled={likeBusy || liked}
        >
          <HeartIcon filled={liked} />
          {liked ? "Liked" : likeBusy ? "Liking..." : "Like this post"}
        </button>
      </div>

      <div className="engagement-grid">
        <form className="engagement-form" onSubmit={handleCommentSubmit}>
          <div className="engagement-form__header">
            <h3>Leave a comment</h3>
            <p>Be kind, be clear, and add something useful for other readers.</p>
          </div>

          <label>
            <span>Name</span>
            <input
              type="text"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              required
            />
          </label>

          <label>
            <span>Comment</span>
            <textarea
              rows="5"
              value={message}
              maxLength={600}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Share your thoughts on this post"
              required
            />
          </label>

          <div className="engagement-form__footer">
            <span>{message.length}/600</span>
            <button type="submit" className="button button-primary" disabled={commentBusy}>
              {commentBusy ? "Posting..." : "Post comment"}
            </button>
          </div>

          {commentMessage ? <p className="form-success">{commentMessage}</p> : null}
          {commentError ? <p className="form-error">{commentError}</p> : null}
        </form>

        <div className="engagement-comments">
          <div className="engagement-form__header">
            <h3>Reader comments</h3>
            <p>{commentCountLabel} so far.</p>
          </div>

          {engagement.comments.length ? (
            <div className="comment-list">
              {[...engagement.comments].reverse().map((comment) => (
                <article key={comment.id} className="comment-card">
                  <div className="comment-card__meta">
                    <strong>{comment.name}</strong>
                    <span>{formatCommentDate(comment.createdAt)}</span>
                  </div>
                  <p>{comment.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="comment-empty-state">
              <p>No comments yet. Be the first to spark the conversation.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
