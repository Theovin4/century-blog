"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  editorCategoryOptions,
  getCategoryMeta,
  getPostTypeMeta,
  isImageMedia,
  isVideoMedia
} from "@/lib/site";

const emptyDraft = {
  id: "",
  title: "",
  excerpt: "",
  content: "",
  category: "nigeria",
  author: ""
};

const emptyAutomation = {
  autoPostingEnabled: true,
  fetchIntervalHours: 2,
  nigeriaShareTarget: 0.7,
  globalShareTarget: 0.3,
  maxPostsPerRun: 2,
  lastRunAt: "",
  lastRunStatus: "idle",
  lastRunMessage: "",
  lastPublishedCount: 0
};

const markdownTools = [
  { label: "H2", action: "heading", insertBefore: "## ", insertAfter: "", placeholder: "Subheading" },
  { label: "Bold", action: "wrap", insertBefore: "**", insertAfter: "**", placeholder: "bold text" },
  { label: "Italic", action: "wrap", insertBefore: "*", insertAfter: "*", placeholder: "italic text" },
  { label: "List", action: "block", insertBefore: "- First point\n- Second point", insertAfter: "", placeholder: "" },
  { label: "Quote", action: "block", insertBefore: "> Quote goes here", insertAfter: "", placeholder: "" },
  { label: "Link", action: "wrap", insertBefore: "[", insertAfter: "](https://example.com)", placeholder: "link text" }
];

export function DashboardShell({ initialPosts }) {
  const router = useRouter();
  const contentRef = useRef(null);
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState(emptyDraft);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState(null);
  const [automationSettings, setAutomationSettings] = useState(emptyAutomation);
  const [providerSummary, setProviderSummary] = useState({});
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  const activeDraftPost = useMemo(
    () => posts.find((post) => String(post.id) === String(draft.id)) || null,
    [posts, draft.id]
  );

  const previewContent = useMemo(() => {
    return draft.content.trim()
      ? draft.content
      : "## Live Preview\n\nYour markdown preview will appear here as you write. Use **bold**, *italic*, headings, lists, quotes, and links.";
  }, [draft.content]);

  const orderedPosts = useMemo(() => {
    return [...posts].sort((left, right) => {
      if ((left.type || "manual") !== (right.type || "manual")) {
        return (left.type || "manual") === "manual" ? -1 : 1;
      }

      if (left.featured !== right.featured) {
        return left.featured ? -1 : 1;
      }

      return new Date(right.publishedAt) - new Date(left.publishedAt);
    });
  }, [posts]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (preview?.objectUrl) {
        URL.revokeObjectURL(preview.objectUrl);
      }
    };
  }, [preview]);

  useEffect(() => {
    let active = true;

    async function loadAutomationSettings() {
      try {
        const response = await fetch("/api/automation/settings", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load dashboard settings.");
        }

        if (!active) {
          return;
        }

        setAutomationSettings(data.settings || emptyAutomation);
        setProviderSummary(data.providers || {});
      } catch (nextError) {
        if (active) {
          setError(nextError.message || "Unable to load dashboard settings.");
        }
      }
    }

    loadAutomationSettings();

    return () => {
      active = false;
    };
  }, []);

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

  function insertMarkdown(tool) {
    const textarea = contentRef.current;
    const currentValue = draft.content || "";

    if (!textarea) {
      const fallbackValue = tool.action === "block"
        ? [currentValue.trim(), tool.insertBefore].filter(Boolean).join("\n\n")
        : `${currentValue}${currentValue ? "\n\n" : ""}${tool.insertBefore}${tool.placeholder}${tool.insertAfter}`;
      updateDraftField("content", fallbackValue);
      return;
    }

    const start = textarea.selectionStart ?? currentValue.length;
    const end = textarea.selectionEnd ?? currentValue.length;
    const selected = currentValue.slice(start, end);
    const value = selected || tool.placeholder;

    const insertion = tool.action === "block"
      ? `${selected ? "" : start > 0 ? "\n\n" : ""}${tool.insertBefore}${selected ? "" : ""}`
      : `${tool.insertBefore}${value}${tool.insertAfter}`;

    const nextValue = `${currentValue.slice(0, start)}${insertion}${currentValue.slice(end)}`;
    updateDraftField("content", nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = tool.action === "block"
        ? start + insertion.length
        : start + tool.insertBefore.length + value.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitBusy(true);

    try {
      const formData = new FormData(event.currentTarget);
      const isEditing = Boolean(draft.id);
      const endpoint = isEditing ? `/api/posts/${draft.id}` : "/api/posts";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(endpoint, { method, body: formData });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save post.");
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
      router.refresh();
      router.prefetch?.("/");
    } catch (nextError) {
      setError(nextError.message || "Unable to save post.");
    } finally {
      setSubmitBusy(false);
    }
  }

  async function handleSetFeatured(postId) {
    setMessage("");
    setError("");
    setSettingsBusy(true);

    try {
      const targetPost = posts.find((post) => String(post.id) === String(postId));

      if (!targetPost || targetPost.featured) {
        return;
      }

      const formData = new FormData();
      formData.append("featured", "true");

      const response = await fetch(`/api/posts/${postId}`, { method: "PATCH", body: formData });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to set featured story.");
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
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to set featured story.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleDelete(postId) {
    setMessage("");
    setError("");
    setSettingsBusy(true);

    try {
      const response = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete post.");
      }

      setPosts((current) => current.filter((post) => String(post.id) !== String(postId)));
      if (draft.id === String(postId)) {
        clearPreview();
        setDraft(emptyDraft);
      }
      setMessage("Post deleted successfully.");
      setToast("Post deleted successfully.");
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to delete post.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  async function updateAutomation(patch) {
    setSettingsBusy(true);
    setError("");

    try {
      const response = await fetch("/api/automation/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(patch)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update automation settings.");
      }

      setAutomationSettings(data.settings || emptyAutomation);
      setProviderSummary(data.providers || {});
      setToast(data.settings?.autoPostingEnabled ? "Auto posting resumed." : "Auto posting paused.");
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to update automation settings.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleRunAutomation() {
    setSettingsBusy(true);
    setError("");

    try {
      const response = await fetch("/api/automation/run", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to run automation.");
      }

      if (Array.isArray(data.createdPosts) && data.createdPosts.length) {
        setPosts((current) => [...data.createdPosts, ...current]);
      }

      setAutomationSettings((current) => ({
        ...current,
        lastRunAt: new Date().toISOString(),
        lastRunStatus: data.status || "success",
        lastRunMessage: data.message || "",
        lastPublishedCount: Number(data.publishedCount || 0)
      }));
      setToast(data.message || "Automation run complete.");
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to run automation.");
    } finally {
      setSettingsBusy(false);
    }
  }

  const previewUrl = preview?.url || activeDraftPost?.mediaUrl || "";
  const previewType = preview?.type || activeDraftPost?.mediaType || "";
  const previewName = preview?.name || activeDraftPost?.mediaName || "";
  const storageReady = providerSummary.storageReady !== false;
  const aiEnhanced = Boolean(providerSummary.openAiRewriteEnabled);

  return (
    <div className="dashboard-shell">
      {toast ? <div className="dashboard-toast">{toast}</div> : null}

      <div className="dashboard-toolbar">
        <p>Logged in. Publish from here, feature stories, and run your news engine without leaving the dashboard.</p>
        <div className="dashboard-toolbar__actions">
          <button type="button" className="button button-secondary" onClick={startCreateMode}>
            New post
          </button>
          <button type="button" className="button button-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      <section className="section-card automation-panel">
        <div className="section-header">
          <div>
            <span className="eyebrow">Automation Control</span>
            <h2>Auto news engine</h2>
          </div>
          <p>
            Nigeria stories are prioritised ahead of world headlines, and your homepage stays fresh automatically.
          </p>
        </div>
        <div className="automation-panel__grid">
          <div className="automation-panel__card">
            <strong>Status</strong>
            <span>{automationSettings.autoPostingEnabled ? "Running" : "Paused"}</span>
          </div>
          <div className="automation-panel__card">
            <strong>Mix</strong>
            <span>{Math.round((automationSettings.nigeriaShareTarget || 0.7) * 100)}% Nigeria / {Math.round((automationSettings.globalShareTarget || 0.3) * 100)}% Global</span>
          </div>
          <div className="automation-panel__card">
            <strong>Posts per run</strong>
            <span>{automationSettings.maxPostsPerRun}</span>
          </div>
          <div className="automation-panel__card">
            <strong>Last run</strong>
            <span>{automationSettings.lastRunAt ? new Date(automationSettings.lastRunAt).toLocaleString("en-NG") : "Not run yet"}</span>
          </div>
        </div>
        <div className="automation-panel__providers">
          <span className={`pill ${providerSummary.newsApiEnabled ? "pill-status-ok" : "pill-status-off"}`}>NewsAPI {providerSummary.newsApiEnabled ? "ready" : "missing"}</span>
          <span className={`pill ${providerSummary.gNewsEnabled ? "pill-status-ok" : "pill-status-off"}`}>GNews {providerSummary.gNewsEnabled ? "ready" : "missing"}</span>
          <span className={`pill ${providerSummary.pexelsEnabled ? "pill-status-ok" : "pill-status-off"}`}>Pexels {providerSummary.pexelsEnabled ? "ready" : "optional"}</span>
          <span className={`pill ${providerSummary.unsplashEnabled ? "pill-status-ok" : "pill-status-off"}`}>Unsplash {providerSummary.unsplashEnabled ? "ready" : "optional"}</span>
          <span className="pill pill-status-ok">Rewrite engine ready</span>
          <span className={`pill ${aiEnhanced ? "pill-status-ok" : "pill-status-off"}`}>AI voice {aiEnhanced ? providerSummary.openAiModel || "on" : "optional"}</span>
          <span className={`pill ${storageReady ? "pill-status-ok" : "pill-status-off"}`}>Storage {storageReady ? "ready" : "missing"}</span>
        </div>
        {!storageReady ? (
          <p className="dashboard-warning">
            Publishing is blocked because production storage is not ready yet. Add your Cloudinary keys in Vercel, then redeploy.
          </p>
        ) : null}
        {!aiEnhanced ? (
          <p className="dashboard-warning dashboard-warning--soft">
            The rewrite engine still works, but premium AI rewrite needs an <code>OPENAI_API_KEY</code> in Vercel.
          </p>
        ) : null}
        <div className="automation-panel__actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => updateAutomation({ autoPostingEnabled: !automationSettings.autoPostingEnabled })}
            disabled={settingsBusy}
          >
            {automationSettings.autoPostingEnabled ? "Pause auto posting" : "Resume auto posting"}
          </button>
          <button type="button" className="button button-secondary" onClick={handleRunAutomation} disabled={settingsBusy}>
            {settingsBusy ? "Running..." : "Run now"}
          </button>
        </div>
        {automationSettings.lastRunMessage ? <p className="automation-panel__note">{automationSettings.lastRunMessage}</p> : null}
      </section>

      <div className="dashboard-grid">
        <form key={draft.id || "create-post"} className="editor-form" onSubmit={handleSubmit}>
          <div className="editor-form__header">
            <h2>{draft.id ? "Edit post" : "Create a post"}</h2>
            <p>
              {draft.id
                ? "Update the selected post and optionally replace its featured media."
                : "Write your article here and publish directly to the site with a rich markdown editor and live preview."}
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
              <div className="markdown-toolbar">
                {markdownTools.map((tool) => (
                  <button
                    key={tool.label}
                    type="button"
                    className="markdown-tool"
                    onClick={() => insertMarkdown(tool)}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>
              <textarea
                ref={contentRef}
                name="content"
                rows="14"
                placeholder="Write your post in Markdown. Use ## headings, **bold**, *italic*, lists, quotes, and links."
                value={draft.content}
                onChange={(event) => updateDraftField("content", event.target.value)}
                required
              />
              <span className="editor-form__hint">Tip: use the toolbar above to insert headings, bold, italic, lists, quotes, and links instantly.</span>
            </label>

            <div className="editor-live-preview">
              <div className="editor-live-preview__header">
                <strong>Live preview</strong>
                <span>Markdown renders exactly like the public post page.</span>
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
              {editorCategoryOptions.map((category) => (
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
                <video className="dashboard-preview__media" controls preload="metadata" poster={activeDraftPost?.posterUrl || undefined}>
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
            <button type="submit" className="button button-primary" disabled={submitBusy}>
              {submitBusy ? (draft.id ? "Saving..." : "Publishing...") : draft.id ? "Save changes" : "Publish post"}
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
            <p>Edit, feature, or remove your latest content here. Auto-fetched posts stay fully editable.</p>
          </div>

          <div className="dashboard-post-list">
            {orderedPosts.map((post) => (
              <article key={post.slug} className="dashboard-post-card">
                <div className="dashboard-post-card__media-wrap">
                  {isVideoMedia(post.mediaUrl, post.mediaType) ? (
                    <video className="dashboard-post-card__media" muted playsInline preload="metadata" poster={post.posterUrl || undefined}>
                      <source src={post.mediaUrl} type={post.mediaType} />
                    </video>
                  ) : isImageMedia(post.mediaUrl, post.mediaType) ? (
                    <img className="dashboard-post-card__media" src={post.mediaUrl} alt={post.title} />
                  ) : null}
                </div>
                <div className="dashboard-post-card__labels">
                  <span className="pill">{getCategoryMeta(post.category).label}</span>
                  <span className={`pill pill-type pill-type--${post.type || "manual"}`}>{getPostTypeMeta(post.type || "manual").label}</span>
                  {post.featured ? <span className="pill pill-featured">Featured story</span> : null}
                </div>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <p className="dashboard-post-card__meta">
                  {post.sourceName ? `Source: ${post.sourceName}` : "Century Blog post"}
                </p>
                <div className="dashboard-post-card__actions">
                  <button
                    type="button"
                    className={`button ${post.featured ? "button-primary" : "button-secondary"}`}
                    onClick={() => handleSetFeatured(post.id)}
                    disabled={post.featured || settingsBusy}
                  >
                    {post.featured ? "Featured story" : "Set as featured"}
                  </button>
                  <button type="button" className="button button-secondary" onClick={() => startEditMode(post)}>
                    Edit
                  </button>
                  <button type="button" className="button button-secondary" onClick={() => handleDelete(post.id)} disabled={settingsBusy}>
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
