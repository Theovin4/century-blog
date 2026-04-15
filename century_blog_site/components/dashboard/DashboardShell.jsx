"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
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

const REQUEST_TIMEOUT_MS = 25000;

async function readResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return { message: text || "Unexpected server response." };
}

async function fetchWithFeedback(input, init = {}, fallbackMessage = "Request failed.") {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const payload = await readResponsePayload(response);

    if (!response.ok) {
      throw new Error(payload?.message || fallbackMessage);
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The request took too long. Refresh the dashboard and try again.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function getLivePostPath(post) {
  return post?.slug ? `/news/${post.slug}` : "/";
}

export function DashboardShell({ initialPosts }) {
  const router = useRouter();
  const contentRef = useRef(null);
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState(emptyDraft);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [resultCard, setResultCard] = useState(null);
  const [preview, setPreview] = useState(null);
  const [automationSettings, setAutomationSettings] = useState(emptyAutomation);
  const [providerSummary, setProviderSummary] = useState({});
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [activePostId, setActivePostId] = useState("");

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

    const timeout = window.setTimeout(() => setToast(null), 4200);
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
        const data = await fetchWithFeedback("/api/automation/settings", { cache: "no-store" }, "Unable to load dashboard settings.");

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

  async function refreshPosts() {
    const data = await fetchWithFeedback("/api/posts", { cache: "no-store" }, "Unable to refresh published posts.");

    if (!Array.isArray(data)) {
      throw new Error("Unable to refresh published posts.");
    }

    setPosts(data);
    return data;
  }

  function clearPreview() {
    setPreview((current) => {
      if (current?.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }
      return null;
    });
  }

  function resetMessages() {
    setMessage("");
    setError("");
  }

  function beginAction(action, postId = "") {
    setActiveAction(action);
    setActivePostId(String(postId || ""));
  }

  function endAction() {
    setActiveAction("");
    setActivePostId("");
  }

  function updateDraftField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function startCreateMode() {
    clearPreview();
    setDraft(emptyDraft);
    resetMessages();
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
    resetMessages();
    setResultCard({
      title: "Editing selected post",
      text: "You are updating an existing article. Save when you are happy with the changes, or open the live version in a new tab.",
      href: getLivePostPath(post),
      actionLabel: "View live post"
    });
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
    resetMessages();
    setSubmitBusy(true);
    beginAction(draft.id ? "save" : "publish", draft.id);

    try {
      const formData = new FormData(event.currentTarget);
      const isEditing = Boolean(draft.id);
      const endpoint = isEditing ? `/api/posts/${draft.id}` : "/api/posts";
      const method = isEditing ? "PATCH" : "POST";

      const data = await fetchWithFeedback(endpoint, { method, body: formData }, "Unable to save post.");

      if (isEditing) {
        setPosts((current) => current.map((post) => (String(post.id) === draft.id ? data : post)));
      } else {
        setPosts((current) => [data, ...current]);
      }

      const successText = isEditing ? "Post updated successfully." : "Post published successfully.";
      const successPost = data;

      setMessage(successText);
      setToast({
        text: successText,
        href: getLivePostPath(successPost),
        actionLabel: "View live post"
      });
      setResultCard({
        title: isEditing ? "Post updated and live" : "Post published and live",
        text: isEditing
          ? "Your update is saved. Open the post to confirm the final public result, or keep writing another piece right away."
          : "Your new story is live on the website. You can open it now or continue with a fresh draft immediately.",
        href: getLivePostPath(successPost),
        actionLabel: "View live post"
      });

      clearPreview();
      setDraft(emptyDraft);
      event.currentTarget.reset();
      router.refresh();
      router.prefetch?.("/");
    } catch (nextError) {
      setError(nextError.message || "Unable to save post.");
    } finally {
      setSubmitBusy(false);
      endAction();
    }
  }

  async function handleSetFeatured(postId) {
    resetMessages();
    setSettingsBusy(true);
    beginAction("feature", postId);

    try {
      const targetPost = posts.find((post) => String(post.id) === String(postId));

      if (!targetPost || targetPost.featured) {
        return;
      }

      const formData = new FormData();
      formData.append("featured", "true");

      const data = await fetchWithFeedback(`/api/posts/${postId}`, { method: "PATCH", body: formData }, "Unable to set featured story.");

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
      setToast({
        text: "Featured story updated successfully.",
        href: getLivePostPath(data),
        actionLabel: "Open featured story"
      });
      setResultCard({
        title: "Featured story changed",
        text: "The homepage spotlight now points to this post. Open it to confirm the public hero section looks exactly right.",
        href: getLivePostPath(data),
        actionLabel: "Open featured story"
      });
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to set featured story.");
    } finally {
      setSettingsBusy(false);
      endAction();
    }
  }

  async function handleDelete(postId) {
    resetMessages();
    setSettingsBusy(true);
    beginAction("delete", postId);

    try {
      await fetchWithFeedback(`/api/posts/${postId}`, { method: "DELETE" }, "Unable to delete post.");

      setPosts((current) => current.filter((post) => String(post.id) !== String(postId)));
      if (draft.id === String(postId)) {
        clearPreview();
        setDraft(emptyDraft);
      }
      setResultCard({
        title: "Post removed",
        text: "The post was deleted from the site and the dashboard list has been refreshed.",
        href: "/",
        actionLabel: "View homepage"
      });
      setMessage("Post deleted successfully.");
      setToast({ text: "Post deleted successfully.", href: "/", actionLabel: "View homepage" });
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to delete post.");
    } finally {
      setSettingsBusy(false);
      endAction();
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  async function updateAutomation(patch) {
    setSettingsBusy(true);
    setError("");
    beginAction(patch.autoPostingEnabled ? "resume" : "pause");

    try {
      const data = await fetchWithFeedback("/api/automation/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(patch)
      }, "Unable to update automation settings.");

      setAutomationSettings(data.settings || emptyAutomation);
      setProviderSummary(data.providers || {});
      setToast({ text: data.settings?.autoPostingEnabled ? "Auto posting resumed." : "Auto posting paused." });
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to update automation settings.");
    } finally {
      setSettingsBusy(false);
      endAction();
    }
  }

  async function handleRunAutomation() {
    setSettingsBusy(true);
    setError("");
    beginAction("run-automation");

    try {
      const data = await fetchWithFeedback("/api/automation/run", { method: "POST" }, "Unable to run automation.");

      if (Array.isArray(data.createdPosts) && data.createdPosts.length) {
        setPosts((current) => [...data.createdPosts, ...current]);
      }
      const leadPost = Array.isArray(data.createdPosts) && data.createdPosts.length
        ? data.createdPosts[0]
        : posts[0];

      setAutomationSettings((current) => ({
        ...current,
        lastRunAt: new Date().toISOString(),
        lastRunStatus: data.status || "success",
        lastRunMessage: data.message || "",
        lastPublishedCount: Number(data.publishedCount || 0)
      }));
      setToast({
        text: data.message || "Automation run complete.",
        href: leadPost ? getLivePostPath(leadPost) : undefined,
        actionLabel: leadPost ? "View newest post" : undefined
      });
      setResultCard({
        title: Number(data.publishedCount || 0) > 0 ? "Automation posted new stories" : "Automation run completed",
        text: data.message || "The automation engine finished its latest run.",
        href: leadPost ? getLivePostPath(leadPost) : "/",
        actionLabel: leadPost ? "View newest post" : "View homepage"
      });
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to run automation.");
    } finally {
      setSettingsBusy(false);
      endAction();
    }
  }

  const previewUrl = preview?.url || activeDraftPost?.mediaUrl || "";
  const previewType = preview?.type || activeDraftPost?.mediaType || "";
  const previewName = preview?.name || activeDraftPost?.mediaName || "";
  const storageReady = providerSummary.storageReady !== false;
  const aiEnhanced = Boolean(providerSummary.openAiRewriteEnabled);

  return (
    <div className="dashboard-shell">
      {toast ? (
        <div className="dashboard-toast">
          <span>{toast.text}</span>
          {toast.href ? (
            <a className="dashboard-toast__link" href={toast.href} target="_blank" rel="noreferrer">
              {toast.actionLabel || "Open"}
            </a>
          ) : null}
        </div>
      ) : null}

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
            {activeAction === "pause" ? "Pausing..." : activeAction === "resume" ? "Resuming..." : automationSettings.autoPostingEnabled ? "Pause auto posting" : "Resume auto posting"}
          </button>
          <button type="button" className="button button-secondary" onClick={handleRunAutomation} disabled={settingsBusy}>
            {activeAction === "run-automation" ? "Running now..." : "Run now"}
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

          {resultCard ? (
            <div className="editor-status-card">
              <div>
                <strong>{resultCard.title}</strong>
                <p>{resultCard.text}</p>
              </div>
              <div className="editor-status-card__actions">
                {resultCard.href ? (
                  <a className="button button-secondary" href={resultCard.href} target="_blank" rel="noreferrer">
                    {resultCard.actionLabel || "Open"}
                  </a>
                ) : null}
                <button type="button" className="button button-secondary" onClick={startCreateMode}>
                  Start a fresh draft
                </button>
              </div>
            </div>
          ) : null}

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
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{previewContent}</ReactMarkdown>
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
              {submitBusy ? (draft.id ? "Saving changes..." : "Publishing post...") : draft.id ? "Save changes" : "Publish post"}
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
                  <a className="button button-secondary" href={getLivePostPath(post)} target="_blank" rel="noreferrer">
                    View live
                  </a>
                  <button
                    type="button"
                    className={`button ${post.featured ? "button-primary" : "button-secondary"}`}
                    onClick={() => handleSetFeatured(post.id)}
                    disabled={post.featured || settingsBusy}
                  >
                    {activeAction === "feature" && activePostId === String(post.id)
                      ? "Setting featured..."
                      : post.featured
                        ? "Featured story"
                        : "Set as featured"}
                  </button>
                  <button type="button" className="button button-secondary" onClick={() => startEditMode(post)}>
                    Edit
                  </button>
                  <button type="button" className="button button-secondary" onClick={() => handleDelete(post.id)} disabled={settingsBusy}>
                    {activeAction === "delete" && activePostId === String(post.id) ? "Deleting..." : "Delete"}
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
