"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { categoryOptions, getCategoryMeta, isImageMedia, isVideoMedia } from "@/lib/site";

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
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState(null);
  const [isPending, startTransition] = useTransition();

  const activeDraftPost = useMemo(
    () => posts.find((post) => String(post.id) === String(draft.id)) || null,
    [posts, draft.id]
  );

  const previewContent = useMemo(() => {
    return draft.content.trim()
      ? draft.content
      : "## Live Preview\n\nYour markdown preview will appear here as you write. Use **bold**, headings, lists, links, and more.";
  }, [draft.content]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (preview?.objectUrl) {
        URL.revokeObjectURL(preview.objectUrl);
      }
    };
  }, [preview]);

  function clearPreview() {
    setPreview((current) => {
      if (current?.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }
      return null;
    });
  }

  function updateDraftField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function startCreateMode() {
    clearPreview();
    setDraft(emptyDraft);
    setMessage("");
    setError("");
  }

  function startEditMode(post) {
    clearPreview();
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

  function handleFileChange(event) {
    const file = event.currentTarget.files?.[0];
    clearPreview();

    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview({
      url: objectUrl,
      type: file.type,
      name: file.name,
      objectUrl
    });
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
      setToast("Post updated successfully.");
    } else {
      setPosts((current) => [data, ...current]);
      setMessage("Post published successfully.");
      setToast("Post published successfully.");
    }

    clearPreview();
    setDraft(emptyDraft);
    event.currentTarget.reset();
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleSetFeatured(postId) {
    setMessage("");
    setError("");

    const targetPost = posts.find((post) => String(post.id) === String(postId));

    if (!targetPost || targetPost.featured) {
      return;
    }

    const formData = new FormData();
    formData.append("featured", "true");

    const response = await fetch(`/api/posts/${postId}`, { method: "PATCH", body: formData });
    const data = await response.json();

    if (!response.ok) {
      setError(data.message || "Unable to set featured story.");
      return;
    }

    setPosts((current) =>
      current.map((post) => {
        if (String(post.id) === String(postId)) {
          return data;
        }

        if (post.featured) {
          return { ...post, featured: false };
        }

        return post;
      })
    );
    setMessage("Featured story updated successfully.");
    setToast("Featured story updated successfully.");
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
      clearPreview();
      setDraft(emptyDraft);
    }
    setMessage("Post deleted successfully.");
    setToast("Post deleted successfully.");
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

  const previewUrl = preview?.url || activeDraftPost?.mediaUrl || "";
  const previewType = preview?.type || activeDraftPost?.mediaType || "";
  const previewName = preview?.name || activeDraftPost?.mediaName || "";

  return (
    <div className="dashboard-shell">
      {toast ? <div className="dashboard-toast">{toast}</div> : null}

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
            <input
              name="title"
              type="text"
              placeholder="Headline"
              value={draft.title}
              onChange={(event) => updateDraftField("title", event.target.value)}
              required
            />
          </label>

          <label>
            <span>Excerpt</span>
            <textarea
              name="excerpt"
              rows="3"
              placeholder="Short summary for homepage cards and SEO"
              value={draft.excerpt}
              onChange={(event) => updateDraftField("excerpt", event.target.value)}
              required
            />
          </label>

          <div className="editor-form__split">
            <label>
              <span>Content</span>
              <textarea
                name="content"
                rows="14"
                placeholder="Write your post in Markdown. Use ## for headings, **bold** text, lists, and links."
                value={draft.content}
                onChange={(event) => updateDraftField("content", event.target.value)}
                required
              />
            </label>

            <div className="editor-live-preview">
              <div className="editor-live-preview__header">
                <strong>Live preview</strong>
                <span>Markdown will render exactly like the post page.</span>
              </div>
              <div className="editor-live-preview__body blog-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewContent}</ReactMarkdown>
              </div>
            </div>
          </div>

          <label>
            <span>Category</span>
            <select
              name="category"
              value={draft.category}
              onChange={(event) => updateDraftField("category", event.target.value)}
              required
            >
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
              value={draft.author}
              onChange={(event) => updateDraftField("author", event.target.value)}
            />
          </label>

          <label>
            <span>{draft.id ? "Replace image or video" : "Upload image or video"}</span>
            <input name="media" type="file" accept="image/*,video/*" onChange={handleFileChange} />
          </label>

          <p className="editor-form__hint">
            Upload one featured image or video. Supported files will be attached to the post.
          </p>

          {previewUrl ? (
            <div className="dashboard-preview">
              <div className="dashboard-preview__header">
                <strong>Media preview</strong>
                {previewName ? <span>{previewName}</span> : null}
              </div>
              {isVideoMedia(previewUrl, previewType) ? (
                <video className="dashboard-preview__media" controls preload="metadata">
                  <source src={previewUrl} type={previewType} />
                </video>
              ) : isImageMedia(previewUrl, previewType) ? (
                <img className="dashboard-preview__media" src={previewUrl} alt="Post preview" />
              ) : null}
            </div>
          ) : null}

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
            <p>Edit, feature, or remove your latest content here.</p>
          </div>

          <div className="dashboard-post-list">
            {posts.map((post) => (
              <article key={post.slug} className="dashboard-post-card">
                <div className="dashboard-post-card__media-wrap">
                  {isVideoMedia(post.mediaUrl, post.mediaType) ? (
                    <video className="dashboard-post-card__media" muted playsInline preload="metadata">
                      <source src={post.mediaUrl} type={post.mediaType} />
                    </video>
                  ) : isImageMedia(post.mediaUrl, post.mediaType) ? (
                    <img className="dashboard-post-card__media" src={post.mediaUrl} alt={post.title} />
                  ) : null}
                </div>
                <div className="dashboard-post-card__labels">
                  <span className="pill">{getCategoryMeta(post.category).label}</span>
                  {post.featured ? <span className="pill pill-featured">Featured story</span> : null}
                </div>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                {post.mediaUrl ? (
                  <p className="dashboard-post-card__meta">
                    {isVideoMedia(post.mediaUrl, post.mediaType) ? "Video attached" : "Image attached"}
                  </p>
                ) : null}
                <div className="dashboard-post-card__actions">
                  <button
                    type="button"
                    className={`button ${post.featured ? "button-primary" : "button-secondary"}`}
                    onClick={() => handleSetFeatured(post.id)}
                    disabled={post.featured}
                  >
                    {post.featured ? "Featured story" : "Set as featured"}
                  </button>
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
