"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { categoryOptions, getCategoryMeta } from "@/lib/site";

const emptyDraft = {
  id: "",
  title: "",
  excerpt: "",
  content: "",
  category: "daily-gist",
  author: ""
};

export function DashboardShell({ initialPosts }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState(emptyDraft);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function startCreateMode() {
    setDraft(emptyDraft);
    setMessage("");
    setError("");
  }

  function startEditMode(post) {
    setDraft({
      id: String(post.id),
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      author: post.author || ""
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const isEditing = Boolean(draft.id);
    const endpoint = isEditing ? `/api/posts/${draft.id}` : "/api/posts";
    const method = isEditing ? "PATCH" : "POST";

    const response = await fetch(endpoint, { method, body: formData });
    const data = await response.json();

    if (!response.ok) {
      setError(data.message || "Unable to save post.");
      return;
    }

    if (isEditing) {
      setPosts((current) => current.map((post) => (String(post.id) === draft.id ? data : post)));
      setMessage("Post updated successfully.");
    } else {
      setPosts((current) => [data, ...current]);
      setMessage("Post published successfully.");
    }

    setDraft(emptyDraft);
    event.currentTarget.reset();
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleDelete(postId) {
    setMessage("");
    setError("");

    const response = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.message || "Unable to delete post.");
      return;
    }

    setPosts((current) => current.filter((post) => String(post.id) !== String(postId)));
    if (draft.id === String(postId)) {
      setDraft(emptyDraft);
    }
    setMessage("Post deleted successfully.");
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
        <div className="dashboard-toolbar__actions">
          <button type="button" className="button button-secondary" onClick={startCreateMode}>
            New post
          </button>
          <button type="button" className="button button-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <form key={draft.id || "create-post"} className="editor-form" onSubmit={handleSubmit}>
          <div className="editor-form__header">
            <h2>{draft.id ? "Edit post" : "Create a post"}</h2>
            <p>
              {draft.id
                ? "Update the selected post and optionally replace its featured media."
                : "Write your article here and publish directly to the site."}
            </p>
          </div>

          <label>
            <span>Title</span>
            <input name="title" type="text" placeholder="Headline" defaultValue={draft.title} required />
          </label>

          <label>
            <span>Excerpt</span>
            <textarea
              name="excerpt"
              rows="3"
              placeholder="Short summary for homepage cards and SEO"
              defaultValue={draft.excerpt}
              required
            />
          </label>

          <label>
            <span>Content</span>
            <textarea
              name="content"
              rows="10"
              placeholder="Write your post. Separate paragraphs with a blank line."
              defaultValue={draft.content}
              required
            />
          </label>

          <label>
            <span>Category</span>
            <select name="category" defaultValue={draft.category} required>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {getCategoryMeta(category).label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Author</span>
            <input
              name="author"
              type="text"
              placeholder="Century Blog Editorial Team"
              defaultValue={draft.author}
            />
          </label>

          <label>
            <span>{draft.id ? "Replace image or video" : "Upload image or video"}</span>
            <input name="media" type="file" accept="image/*,video/*" />
          </label>

          <p className="editor-form__hint">
            Upload one featured image or video. Supported files will be attached to the post.
          </p>

          {message ? <p className="form-success">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}

          <div className="editor-form__actions">
            <button type="submit" className="button button-primary" disabled={isPending}>
              {isPending ? (draft.id ? "Saving..." : "Publishing...") : draft.id ? "Save changes" : "Publish post"}
            </button>
            {draft.id ? (
              <button type="button" className="button button-secondary" onClick={startCreateMode}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <aside className="post-list-panel">
          <div className="editor-form__header">
            <h2>Published posts</h2>
            <p>Edit or remove your latest content here.</p>
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
                <div className="dashboard-post-card__actions">
                  <button type="button" className="button button-secondary" onClick={() => startEditMode(post)}>
                    Edit
                  </button>
                  <button type="button" className="button button-secondary" onClick={() => handleDelete(post.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
