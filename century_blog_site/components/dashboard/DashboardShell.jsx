"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getCategoryMeta } from "@/lib/site";

const categoryOptions = ["lifestyle", "health", "education", "daily-gist"];

export function DashboardShell({ initialPosts }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/posts", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.message || "Unable to create post.");
      return;
    }

    setPosts((current) => [data, ...current]);
    setMessage("Post published successfully.");
    event.currentTarget.reset();
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="dashboard-shell">
      <div className="dashboard-toolbar">
        <p>Logged in. New posts will appear on the homepage automatically.</p>
        <button type="button" className="button button-secondary" onClick={handleLogout}>
          Log out
        </button>
      </div>

      <div className="dashboard-grid">
        <form className="editor-form" onSubmit={handleSubmit}>
          <div className="editor-form__header">
            <h2>Create a post</h2>
            <p>Write your article here and publish directly to the site.</p>
          </div>

          <label>
            <span>Title</span>
            <input name="title" type="text" placeholder="Headline" required />
          </label>

          <label>
            <span>Excerpt</span>
            <textarea
              name="excerpt"
              rows="3"
              placeholder="Short summary for homepage cards and SEO"
              required
            />
          </label>

          <label>
            <span>Content</span>
            <textarea
              name="content"
              rows="10"
              placeholder="Write your post. Separate paragraphs with a blank line."
              required
            />
          </label>

          <label>
            <span>Category</span>
            <select name="category" defaultValue="daily-gist" required>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {getCategoryMeta(category).label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Author</span>
            <input name="author" type="text" placeholder="Century Blog Editorial Team" />
          </label>

          <label>
            <span>Upload image or video</span>
            <input name="media" type="file" accept="image/*,video/*" />
          </label>

          <p className="editor-form__hint">
            Upload one featured image or video. Supported files will be attached to the post.
          </p>

          {message ? <p className="form-success">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="button button-primary" disabled={isPending}>
            {isPending ? "Publishing..." : "Publish post"}
          </button>
        </form>

        <aside className="post-list-panel">
          <div className="editor-form__header">
            <h2>Published posts</h2>
            <p>Your latest content appears here.</p>
          </div>

          <div className="dashboard-post-list">
            {posts.map((post) => (
              <article key={post.slug} className="dashboard-post-card">
                <span className="pill">{getCategoryMeta(post.category).label}</span>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                {post.mediaUrl ? (
                  <p className="dashboard-post-card__meta">
                    {post.mediaType?.startsWith("video/") ? "Video attached" : "Image attached"}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
