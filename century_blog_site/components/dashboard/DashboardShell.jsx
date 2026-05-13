"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  editorCategoryOptions,
  getCategoryMeta,
  getDisplayMedia,
  getOptimizedImageUrl,
  getPostTypeMeta,
  getWorkflowStatusMeta,
  getProxiedImageUrl,
  getRenderableContent,
  isAbsoluteUrl,
  isImageMedia,
  isSensitivePost,
  isVideoMedia
} from "@/lib/site";

const emptyDraft = {
  id: "",
  title: "",
  excerpt: "",
  content: "",
  category: "nigeria",
  author: "",
  seoTitle: "",
  metaDescription: "",
  tags: "",
  imageAlt: "",
  sourceName: "",
  sourceUrl: "",
  sourceCountry: "",
  sourceLinks: "",
  workflowStatus: "draft",
  scheduledFor: "",
  reviewNotes: ""
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
  { label: "H3", action: "heading", insertBefore: "### ", insertAfter: "", placeholder: "Detail point" },
  { label: "Bold", action: "wrap", insertBefore: "**", insertAfter: "**", placeholder: "bold text" },
  { label: "Italic", action: "wrap", insertBefore: "*", insertAfter: "*", placeholder: "italic text" },
  { label: "List", action: "block", insertBefore: "- First point\n- Second point", insertAfter: "", placeholder: "" },
  { label: "Quote", action: "block", insertBefore: "> Quote goes here", insertAfter: "", placeholder: "" },
  { label: "Link", action: "wrap", insertBefore: "[", insertAfter: "](https://example.com)", placeholder: "link text" }
];

const REQUEST_TIMEOUT_MS = 25000;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;
const LAST_EDITOR_DEFAULTS_KEY = "century-blog-editor-defaults";
const AUTO_TAG_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "because", "by", "for", "from",
  "how", "in", "into", "is", "it", "its", "of", "on", "or", "that", "the",
  "their", "this", "to", "what", "when", "where", "who", "why", "with", "will"
]);

const markdownPreviewComponents = {
  img({ src, alt = "" }) {
    const target = String(src || "");

    if (!target) {
      return null;
    }

    const imageSrc = getProxiedImageUrl(target);
    const displaySrc = isImageMedia(imageSrc)
      ? getOptimizedImageUrl(imageSrc, { width: 1200, height: 800, fit: "fit" })
      : imageSrc;

    return (
      <img
        className="blog-content__image"
        src={displaySrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy={isAbsoluteUrl(target) ? "no-referrer" : undefined}
      />
    );
  },
  a({ href, children, ...props }) {
    const target = String(href || "");
    const childText = Array.isArray(children) ? children.join("").trim() : String(children || "").trim();
    const shouldRenderAsImage = target && isImageMedia(target) && (!childText || childText === target);

    if (shouldRenderAsImage) {
      const imageSrc = getProxiedImageUrl(target);
      const displaySrc = getOptimizedImageUrl(imageSrc, { width: 1200, height: 800, fit: "fit" });

      return (
        <img
          className="blog-content__image"
          src={displaySrc}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy={isAbsoluteUrl(target) ? "no-referrer" : undefined}
        />
      );
    }

    return <a href={href} {...props}>{children}</a>;
  }
};

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

function resolveSubmitModeToWorkflowStatus(mode) {
  if (mode === "submit") {
    return "pending_review";
  }

  if (mode === "publish") {
    return "published";
  }

  return mode || "draft";
}

function toPlainText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_~`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();

  if (!text || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildAutoTags({ title, excerpt, category }) {
  const categoryLabel = getCategoryMeta(category || "nigeria").label.toLowerCase();
  const words = `${title || ""} ${excerpt || ""}`
    .toLowerCase()
    .match(/[a-z0-9]+/g);

  const tags = [];
  const seen = new Set();

  function pushTag(value) {
    const normalized = String(value || "").trim().toLowerCase();

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    tags.push(normalized);
  }

  pushTag(categoryLabel);

  for (const word of words || []) {
    if (word.length < 4 || AUTO_TAG_STOPWORDS.has(word)) {
      continue;
    }

    pushTag(word);

    if (tags.length >= 5) {
      break;
    }
  }

  return tags.join(", ");
}

function getDefaultSourceCountry(category) {
  return category === "world" ? "Global" : "Nigeria";
}

function readStoredEditorDefaults() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(LAST_EDITOR_DEFAULTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredEditorDefaults(defaults) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LAST_EDITOR_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // Ignore local storage write failures so posting still works.
  }
}

function buildResolvedDraft(draft, currentUser, editorDefaults) {
  const fallbackAuthor =
    editorDefaults.author ||
    currentUser?.name ||
    currentUser?.username ||
    "Century Blog Editorial Team";
  const plainExcerpt = toPlainText(draft.excerpt);
  const plainContent = toPlainText(draft.content);
  const metaBase = plainExcerpt || plainContent;

  return {
    ...draft,
    category: draft.category || editorDefaults.category || "nigeria",
    author: draft.author || fallbackAuthor,
    seoTitle: draft.seoTitle || truncateText(draft.title, 65),
    metaDescription: draft.metaDescription || truncateText(metaBase, 160),
    tags: draft.tags || buildAutoTags(draft),
    imageAlt:
      draft.imageAlt ||
      (draft.title
        ? `${draft.title} featured image`
        : `${getCategoryMeta(draft.category || editorDefaults.category || "nigeria").label} featured image`),
    sourceName: draft.sourceName || editorDefaults.sourceName || "",
    sourceCountry: draft.sourceCountry || editorDefaults.sourceCountry || getDefaultSourceCountry(draft.category || editorDefaults.category || "nigeria")
  };
}

export function DashboardShell({ initialPosts, currentUser }) {
  const router = useRouter();
  const contentRef = useRef(null);
  const inlineImageInputRef = useRef(null);
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState(emptyDraft);
  const [editorDefaults, setEditorDefaults] = useState(() => readStoredEditorDefaults());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [resultCard, setResultCard] = useState(null);
  const [preview, setPreview] = useState(null);
  const [automationSettings, setAutomationSettings] = useState(emptyAutomation);
  const [providerSummary, setProviderSummary] = useState({});
  const [autoDrafts, setAutoDrafts] = useState([]);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [activePostId, setActivePostId] = useState("");
  const [postListFilter, setPostListFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [automationLoaded, setAutomationLoaded] = useState(false);
  const [overview, setOverview] = useState({
    pendingReviewCount: 0,
    publishedCount: 0,
    draftCount: 0,
    recentActivity: [],
    moderatorPerformance: []
  });
  const [userForm, setUserForm] = useState({
    id: "",
    name: "",
    email: "",
    username: "",
    role: "moderator",
    status: "active",
    password: ""
  });
  const [logSearch, setLogSearch] = useState("");
  const [submitMode, setSubmitMode] = useState(() => (currentUser?.role === "admin" || currentUser?.role === "super_admin" ? "publish" : "submit"));
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [inlineImageBusy, setInlineImageBusy] = useState(false);

  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin" || isSuperAdmin;
  const canReview = isAdmin;
  const canManageUsers = isSuperAdmin;
  const canManageAutomation = isSuperAdmin;
  const currentUserId = String(currentUser?.id || "");

  const activeDraftPost = useMemo(
    () => posts.find((post) => String(post.id) === String(draft.id)) || null,
    [posts, draft.id]
  );

  const previewContent = useMemo(() => {
    return draft.content.trim()
      ? getRenderableContent(draft.content)
      : "## Live Preview\n\nYour markdown preview will appear here as you write. Use **bold**, *italic*, headings, lists, quotes, and links.";
  }, [draft.content]);

  const resolvedDraft = useMemo(
    () => buildResolvedDraft(draft, currentUser, editorDefaults),
    [currentUser, draft, editorDefaults]
  );

  const sourceWarningVisible = useMemo(() => {
    return isSensitivePost({
      title: resolvedDraft.title,
      excerpt: resolvedDraft.excerpt,
      content: resolvedDraft.content,
      category: resolvedDraft.category,
      sourceUrl: resolvedDraft.sourceUrl,
      sourceLinks: resolvedDraft.sourceLinks
    }) && !String(resolvedDraft.sourceUrl || "").trim() && !String(resolvedDraft.sourceLinks || "").trim();
  }, [resolvedDraft]);

  const orderedPosts = useMemo(() => {
    return [...posts].sort((left, right) => {
      if (left.featured !== right.featured) {
        return left.featured ? -1 : 1;
      }

      return new Date(right.updatedAt || right.publishedAt) - new Date(left.updatedAt || left.publishedAt);
    });
  }, [posts]);

  const postTypeCounts = useMemo(() => {
    return posts.reduce(
      (totals, post) => {
        const type = (post.type || "manual") === "auto" ? "auto" : "manual";
        totals[type] += 1;
        totals.all += 1;
        return totals;
      },
      { all: 0, manual: 0, auto: 0 }
    );
  }, [posts]);

  const visiblePosts = useMemo(() => {
    const scopedPosts = isAdmin
      ? orderedPosts
      : orderedPosts.filter((post) => String(post.createdBy || "") === currentUserId);

    if (postListFilter === "all") {
      return scopedPosts;
    }

    if (postListFilter === "review") {
      return scopedPosts.filter((post) => String(post.workflowStatus || "") === "pending_review");
    }

    return scopedPosts.filter((post) => (post.type || "manual") === postListFilter);
  }, [currentUserId, isAdmin, orderedPosts, postListFilter]);

  const pendingReviewPosts = useMemo(
    () => posts.filter((post) => String(post.workflowStatus || "") === "pending_review"),
    [posts]
  );

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

    async function loadDashboardCore() {
      try {
        const [notificationsData, overviewData] = await Promise.all([
          fetchWithFeedback("/api/admin/notifications", { cache: "no-store" }, "Unable to load notifications."),
          fetchWithFeedback("/api/admin/overview", { cache: "no-store" }, "Unable to load overview.")
        ]);

        if (!active) {
          return;
        }

        setNotifications(Array.isArray(notificationsData) ? notificationsData : []);
        setOverview(overviewData || {});
      } catch (nextError) {
        if (active) {
          setError(nextError.message || "Unable to load dashboard.");
        }
      }
    }

    loadDashboardCore();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!canManageAutomation) {
      return undefined;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        const settingsData = await fetchWithFeedback(
          "/api/automation/settings",
          { cache: "no-store" },
          "Unable to load dashboard settings."
        );

        if (!active) {
          return;
        }

        setAutomationSettings(settingsData?.settings || emptyAutomation);
        setProviderSummary(settingsData?.providers || {});
        setAutomationLoaded(true);

        const draftsData = await fetchWithFeedback(
          "/api/automation/drafts",
          { cache: "no-store" },
          "Unable to load auto drafts."
        );

        if (!active) {
          return;
        }

        setAutoDrafts(Array.isArray(draftsData) ? draftsData : []);
      } catch (nextError) {
        if (active) {
          setError((current) => current || nextError.message || "Unable to load automation details.");
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [canManageAutomation]);

  useEffect(() => {
    if (!canManageUsers) {
      return undefined;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        const usersData = await fetchWithFeedback(
          "/api/admin/users",
          { cache: "no-store" },
          "Unable to load team accounts."
        );

        if (!active) {
          return;
        }

        setUsers(Array.isArray(usersData) ? usersData : []);
        setUsersLoaded(true);
      } catch (nextError) {
        if (active) {
          setError((current) => current || nextError.message || "Unable to load team accounts.");
        }
      }
    }, 700);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [canManageUsers]);

  async function refreshPosts() {
    const data = await fetchWithFeedback("/api/posts", { cache: "no-store" }, "Unable to refresh published posts.");

    if (!Array.isArray(data)) {
      throw new Error("Unable to refresh published posts.");
    }

    setPosts(data);
    return data;
  }

  async function refreshAutoDrafts() {
    const data = await fetchWithFeedback("/api/automation/drafts", { cache: "no-store" }, "Unable to refresh auto drafts.");

    if (!Array.isArray(data)) {
      throw new Error("Unable to refresh auto drafts.");
    }

    setAutoDrafts(data);
    return data;
  }

  async function refreshOverview() {
    const data = await fetchWithFeedback("/api/admin/overview", { cache: "no-store" }, "Unable to refresh overview.");
    setOverview(data || {});
    return data;
  }

  async function refreshNotifications() {
    const data = await fetchWithFeedback("/api/admin/notifications", { cache: "no-store" }, "Unable to refresh notifications.");
    setNotifications(Array.isArray(data) ? data : []);
    return data;
  }

  async function refreshUsers() {
    if (!canManageUsers) {
      return [];
    }

    const data = await fetchWithFeedback("/api/admin/users", { cache: "no-store" }, "Unable to refresh team accounts.");
    setUsers(Array.isArray(data) ? data : []);
    setUsersLoaded(true);
    return data;
  }

  async function refreshLogs(query = logSearch) {
    if (!canManageUsers) {
      return [];
    }

    const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
    const data = await fetchWithFeedback(`/api/admin/logs${suffix}`, { cache: "no-store" }, "Unable to refresh activity logs.");
    setActivityLogs(Array.isArray(data) ? data : []);
    setLogsLoaded(true);
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
    setDraft((current) => ({
      ...emptyDraft,
      category: editorDefaults.category || current.category || emptyDraft.category
    }));
    setShowAdvancedFields(false);
    setShowPreview(false);
    setSubmitMode(isAdmin ? "publish" : "submit");
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
      author: post.author || "",
      seoTitle: post.seoTitle || "",
      metaDescription: post.metaDescription || "",
      tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
      imageAlt: post.imageAlt || "",
      sourceName: post.sourceName || "",
      sourceUrl: post.sourceUrl || "",
      sourceCountry: post.sourceCountry || "",
      sourceLinks: Array.isArray(post.sourceLinks)
        ? post.sourceLinks.map((item) => `${item.label || ""}|${item.url || ""}`).join("\n")
        : "",
      workflowStatus: post.workflowStatus || "draft",
      scheduledFor: post.scheduledFor || "",
      reviewNotes: post.reviewNotes || ""
    });
    setSubmitMode(post.workflowStatus === "published" ? "publish" : post.workflowStatus || "draft");
    setShowAdvancedFields(true);
    setShowPreview(true);
    resetMessages();
    setResultCard({
      title: "Editing selected post",
      text: "You are updating an existing article. Save when you are happy with the changes, or open the live version in a new tab.",
      href: getLivePostPath(post),
      actionLabel: "View live post"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startDraftReviewMode(draftPost) {
    clearPreview();
    setDraft({
      id: "",
      title: draftPost.title,
      excerpt: draftPost.excerpt,
      content: draftPost.content,
      category: draftPost.category,
      author: draftPost.author || "",
      seoTitle: draftPost.seoTitle || "",
      metaDescription: draftPost.metaDescription || "",
      tags: Array.isArray(draftPost.tags) ? draftPost.tags.join(", ") : "",
      imageAlt: draftPost.imageAlt || "",
      sourceName: draftPost.sourceName || "",
      sourceUrl: draftPost.sourceUrl || "",
      sourceCountry: draftPost.sourceCountry || "",
      sourceLinks: Array.isArray(draftPost.sourceLinks)
        ? draftPost.sourceLinks.map((item) => `${item.label || ""}|${item.url || ""}`).join("\n")
        : "",
      workflowStatus: "draft",
      scheduledFor: draftPost.scheduledFor || "",
      reviewNotes: draftPost.reviewNotes || ""
    });
    setSubmitMode("publish");
    setShowAdvancedFields(true);
    setShowPreview(true);
    resetMessages();
    setResultCard({
      title: "Reviewing queued auto draft",
      text: "This weak auto post was held back from public publishing. Improve it in the editor, then publish manually when it is strong enough for the live site.",
      href: draftPost.sourceUrl || "",
      actionLabel: draftPost.sourceUrl ? "Open source article" : "Open source"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFileChange(event) {
    const file = event.currentTarget.files?.[0];
    clearPreview();
    setError("");

    if (!file) {
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setError("Only image and video uploads are supported.");
      event.currentTarget.value = "";
      return;
    }

    if (isImage && file.size > MAX_IMAGE_SIZE) {
      setError("Images must be 8MB or smaller.");
      event.currentTarget.value = "";
      return;
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      setError("Videos must be 20MB or smaller.");
      event.currentTarget.value = "";
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

  async function handleInlineImageUpload(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Only image files can be inserted inside article content.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Inline article images must be 8MB or smaller.");
      return;
    }

    setInlineImageBusy(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("image", file);
      const upload = await fetchWithFeedback("/api/uploads/article-image", {
        method: "POST",
        body: formData
      }, "Unable to upload inline article image.");
      const altText = upload.alt || file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
      const markdown = `![${altText}](${upload.url})`;
      const textarea = contentRef.current;
      const currentValue = draft.content || "";

      if (!textarea) {
        updateDraftField("content", [currentValue.trim(), markdown].filter(Boolean).join("\n\n"));
      } else {
        const start = textarea.selectionStart ?? currentValue.length;
        const end = textarea.selectionEnd ?? currentValue.length;
        const insertion = `${start > 0 ? "\n\n" : ""}${markdown}\n\n`;
        const nextValue = `${currentValue.slice(0, start)}${insertion}${currentValue.slice(end)}`;
        updateDraftField("content", nextValue);
        requestAnimationFrame(() => {
          textarea.focus();
          const cursor = start + insertion.length;
          textarea.setSelectionRange(cursor, cursor);
        });
      }

      setToast({
        text: "Inline image uploaded and inserted into the article.",
        href: upload.url,
        actionLabel: "Open image"
      });
      setShowPreview(true);
    } catch (nextError) {
      setError(nextError.message || "Unable to upload inline image.");
    } finally {
      setInlineImageBusy(false);
    }
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
    const mode = event.nativeEvent?.submitter?.dataset?.mode || submitMode;
    beginAction(draft.id ? "save" : mode, draft.id);

    try {
      const formData = new FormData(event.currentTarget);
      const isEditing = Boolean(draft.id);
      const endpoint = isEditing ? `/api/posts/${draft.id}` : "/api/posts";
      const method = isEditing ? "PATCH" : "POST";
      formData.set("category", resolvedDraft.category);
      formData.set("author", resolvedDraft.author);
      formData.set("seoTitle", resolvedDraft.seoTitle);
      formData.set("metaDescription", resolvedDraft.metaDescription);
      formData.set("tags", resolvedDraft.tags);
      formData.set("imageAlt", resolvedDraft.imageAlt);
      formData.set("sourceName", resolvedDraft.sourceName);
      formData.set("sourceCountry", resolvedDraft.sourceCountry);
      formData.set("workflowStatus", resolveSubmitModeToWorkflowStatus(mode));

      const data = await fetchWithFeedback(endpoint, { method, body: formData }, "Unable to save post.");

      if (isEditing) {
        setPosts((current) => current.map((post) => (String(post.id) === draft.id ? data : post)));
      } else {
        setPosts((current) => [data, ...current]);
      }

      const successText =
        data.workflowStatus === "pending_review"
          ? "Post submitted for review successfully."
          : data.workflowStatus === "draft"
            ? "Draft saved successfully."
            : isEditing
              ? "Post updated successfully."
              : "Post published successfully.";
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
      const nextDefaults = {
        author: resolvedDraft.author,
        sourceName: resolvedDraft.sourceName,
        sourceCountry: resolvedDraft.sourceCountry,
        category: resolvedDraft.category
      };
      saveStoredEditorDefaults(nextDefaults);
      setEditorDefaults(nextDefaults);
      setDraft({
        ...emptyDraft,
        category: resolvedDraft.category
      });
      setShowAdvancedFields(false);
      setShowPreview(false);
      setSubmitMode(isAdmin ? "publish" : "submit");
      event.currentTarget.reset();
      await refreshAutoDrafts().catch(() => undefined);
      await Promise.all([
        refreshOverview().catch(() => undefined),
        refreshNotifications().catch(() => undefined),
        refreshUsers().catch(() => undefined)
      ]);
      router.refresh();
      router.prefetch?.("/");
    } catch (nextError) {
      if ((nextError.message || "").includes("Source needed before publication.")) {
        setShowAdvancedFields(true);
        setError("This story needs at least one verified source link before it can be submitted or published. Open Advanced settings and add the source.");
      } else {
        setError(nextError.message || "Unable to save post.");
      }
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
      await refreshOverview().catch(() => undefined);
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
      await Promise.all([
        refreshOverview().catch(() => undefined),
        refreshUsers().catch(() => undefined),
        refreshNotifications().catch(() => undefined)
      ]);
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
      await refreshOverview().catch(() => undefined);
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
      await refreshAutoDrafts().catch(() => undefined);
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
        details: Array.isArray(data.skippedPosts)
          ? data.skippedPosts.slice(0, 5).map((item) => {
              const detailText = Array.isArray(item.details) && item.details.length
                ? ` (${item.details.join(", ")})`
                : "";
              return `${item.title}: ${item.reason}${detailText}`;
            })
          : [],
        href: leadPost ? getLivePostPath(leadPost) : "/",
        actionLabel: leadPost ? "View newest post" : "View homepage"
      });
      await refreshOverview().catch(() => undefined);
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to run automation.");
    } finally {
      setSettingsBusy(false);
      endAction();
    }
  }

  async function handlePublishAutoDraft(draftId) {
    setSettingsBusy(true);
    setError("");
    beginAction("publish-draft", draftId);

    try {
      const data = await fetchWithFeedback(`/api/automation/drafts/${draftId}/publish`, { method: "POST" }, "Unable to publish auto draft.");
      setPosts((current) => [data, ...current]);
      setAutoDrafts((current) => current.filter((draftItem) => String(draftItem.id) !== String(draftId)));
      setToast({
        text: "Draft published successfully.",
        href: getLivePostPath(data),
        actionLabel: "View live post"
      });
      setResultCard({
        title: "Queued auto draft published",
        text: "The reviewed draft is now live on the site. Open it to confirm the final public result.",
        href: getLivePostPath(data),
        actionLabel: "View live post"
      });
      await refreshOverview().catch(() => undefined);
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to publish auto draft.");
    } finally {
      setSettingsBusy(false);
      endAction();
    }
  }

  async function handleDiscardAutoDraft(draftId) {
    setSettingsBusy(true);
    setError("");
    beginAction("discard-draft", draftId);

    try {
      await fetchWithFeedback(`/api/automation/drafts/${draftId}`, { method: "DELETE" }, "Unable to discard auto draft.");
      setAutoDrafts((current) => current.filter((draftItem) => String(draftItem.id) !== String(draftId)));
      setToast({ text: "Draft discarded." });
    } catch (nextError) {
      setError(nextError.message || "Unable to discard auto draft.");
    } finally {
      setSettingsBusy(false);
      endAction();
    }
  }

  async function handleUserSubmit(event) {
    event.preventDefault();
    setSettingsBusy(true);
    setError("");
    beginAction(userForm.id ? "update-user" : "create-user", userForm.id);

    try {
      const payload = {
        name: userForm.name,
        email: userForm.email,
        username: userForm.username,
        role: userForm.role,
        status: userForm.status
      };

      if (userForm.password) {
        payload.password = userForm.password;
        payload.resetPassword = userForm.password;
      }

      if (userForm.id) {
        await fetchWithFeedback(`/api/admin/users/${userForm.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }, "Unable to update account.");
      } else {
        await fetchWithFeedback("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }, "Unable to create account.");
      }

      await Promise.all([refreshUsers(), refreshLogs(), refreshNotifications()]);
      setUserForm({
        id: "",
        name: "",
        email: "",
        username: "",
        role: "moderator",
        status: "active",
        password: ""
      });
      setToast({ text: userForm.id ? "Team account updated." : "Team account created." });
    } catch (nextError) {
      setError(nextError.message || "Unable to save user.");
    } finally {
      setSettingsBusy(false);
      endAction();
    }
  }

  function startUserEdit(user) {
    setUserForm({
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      username: user.username || "",
      role: user.role || "moderator",
      status: user.status || "active",
      password: ""
    });
  }

  async function markNotificationAsRead(id) {
    try {
      await fetchWithFeedback("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      }, "Unable to update notification.");
      await refreshNotifications();
    } catch {
      // Keep notifications non-blocking.
    }
  }

  const activeDraftMedia = activeDraftPost ? getDisplayMedia(activeDraftPost, "card") : null;
  const previewUrl = preview?.url || activeDraftMedia?.url || "";
  const previewType = preview?.type || activeDraftMedia?.type || activeDraftPost?.mediaType || "";
  const previewPosterUrl = activeDraftMedia?.posterUrl || activeDraftPost?.posterUrl || "";
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
        <p>
          Signed in as <strong>{currentUser.name || currentUser.username}</strong>. Role:{" "}
          <strong>{String(currentUser.role || "").replace(/_/g, " ")}</strong>.
        </p>
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
            <span className="eyebrow">Editorial Overview</span>
            <h2>Dashboard analytics and review queue</h2>
          </div>
          <p>Track submissions, published output, recent moderation activity, and team performance without leaving the dashboard.</p>
        </div>
        <div className="automation-panel__grid">
          <div className="automation-panel__card">
            <strong>Pending review</strong>
            <span>{overview.pendingReviewCount || 0}</span>
          </div>
          <div className="automation-panel__card">
            <strong>Published</strong>
            <span>{overview.publishedCount || 0}</span>
          </div>
          <div className="automation-panel__card">
            <strong>Your drafts</strong>
            <span>{overview.draftCount || 0}</span>
          </div>
          <div className="automation-panel__card">
            <strong>Unread alerts</strong>
            <span>{notifications.filter((item) => !item.read).length}</span>
          </div>
        </div>
        {notifications.length ? (
          <div className="dashboard-post-list">
            {notifications.slice(0, 5).map((notification) => (
              <article key={notification.id} className="dashboard-post-card">
                <div className="dashboard-post-card__labels">
                  <span className="pill">{notification.type}</span>
                  {!notification.read ? <span className="pill pill-featured">New</span> : null}
                </div>
                <h3>{notification.title}</h3>
                <p>{notification.message}</p>
                <div className="dashboard-post-card__actions">
                  {!notification.read ? (
                    <button type="button" className="button button-secondary" onClick={() => markNotificationAsRead(notification.id)}>
                      Mark as read
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {canManageAutomation ? (
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
          <div className="automation-panel__card">
            <strong>Draft queue</strong>
            <span>{autoDrafts.length}</span>
          </div>
        </div>
        <div className="automation-panel__providers">
          <span className={`pill ${providerSummary.newsApiEnabled ? "pill-status-ok" : "pill-status-off"}`}>NewsAPI {providerSummary.newsApiEnabled ? "ready" : "missing"}</span>
          <span className={`pill ${providerSummary.gNewsEnabled ? "pill-status-ok" : "pill-status-off"}`}>GNews {providerSummary.gNewsEnabled ? "ready" : "missing"}</span>
          <span className={`pill ${providerSummary.pexelsEnabled ? "pill-status-ok" : "pill-status-off"}`}>Pexels {providerSummary.pexelsEnabled ? "ready" : "optional"}</span>
          <span className={`pill ${providerSummary.unsplashEnabled ? "pill-status-ok" : "pill-status-off"}`}>Unsplash {providerSummary.unsplashEnabled ? "ready" : "optional"}</span>
          <span className="pill pill-status-ok">Rewrite engine ready</span>
          <span className={`pill ${providerSummary.cronSecretEnabled ? "pill-status-ok" : "pill-status-off"}`}>Cron auth {providerSummary.cronSecretEnabled ? "ready" : "missing"}</span>
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
        {!providerSummary.cronSecretEnabled ? (
          <p className="dashboard-warning dashboard-warning--soft">
            Scheduled auto posting needs a <code>CRON_SECRET</code> or <code>AUTO_NEWS_CRON_SECRET</code> in Vercel so cron requests can reach the automation route securely.
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
        {!automationLoaded ? <p className="automation-panel__note">Loading automation details...</p> : null}
        {automationSettings.lastRunMessage ? <p className="automation-panel__note">{automationSettings.lastRunMessage}</p> : null}
      </section>
      ) : null}

      {canReview ? (
      <section className="section-card automation-panel">
        <div className="section-header">
          <div>
            <span className="eyebrow">Auto Draft Review</span>
            <h2>Weak auto posts held for review</h2>
          </div>
          <p>Anything that fails the stronger quality gate now lands here instead of going live. Review, publish manually, or discard it before your next AdSense submission.</p>
        </div>
        <div className="dashboard-post-list">
          {autoDrafts.map((draftItem) => (
            <article key={draftItem.id} className="dashboard-post-card">
              <div className="dashboard-post-card__labels">
                <span className="pill">{getCategoryMeta(draftItem.category).label}</span>
                <span className="pill pill-status-off">Held from auto publish</span>
              </div>
              <h3>{draftItem.title}</h3>
              <p>{draftItem.excerpt}</p>
              <p className="dashboard-post-card__meta">
                {draftItem.sourceName ? `Source: ${draftItem.sourceName}` : "No source label"} | Issues: {(draftItem.qualityReport?.reasons || []).slice(0, 4).join(", ") || "needs review"}
              </p>
              <div className="dashboard-post-card__actions">
                <button type="button" className="button button-secondary" onClick={() => startDraftReviewMode(draftItem)}>
                  Open in editor
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => handlePublishAutoDraft(draftItem.id)}
                  disabled={settingsBusy}
                >
                  {activeAction === "publish-draft" && activePostId === String(draftItem.id) ? "Publishing..." : "Publish draft"}
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => handleDiscardAutoDraft(draftItem.id)}
                  disabled={settingsBusy}
                >
                  {activeAction === "discard-draft" && activePostId === String(draftItem.id) ? "Discarding..." : "Discard"}
                </button>
              </div>
            </article>
          ))}
          {!autoDrafts.length ? <p className="empty-state">No weak auto drafts are waiting for review right now.</p> : null}
        </div>
      </section>
      ) : null}

      {canReview ? (
        <section className="section-card automation-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Approval Queue</span>
              <h2>Pending editorial review</h2>
            </div>
            <p>Moderators can submit drafts here for approval. Admins can open the post in the editor, refine it, and publish when ready.</p>
          </div>
          <div className="dashboard-post-list">
            {pendingReviewPosts.map((post) => (
              <article key={post.id} className="dashboard-post-card">
                <div className="dashboard-post-card__labels">
                  <span className="pill">{getCategoryMeta(post.category).label}</span>
                  <span className="pill pill-status-off">{getWorkflowStatusMeta(post.workflowStatus).label}</span>
                </div>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <p className="dashboard-post-card__meta">
                  Submitted by {post.createdByName || post.author || "Unknown"} {post.submittedAt ? `| ${new Date(post.submittedAt).toLocaleString("en-NG")}` : ""}
                </p>
                <div className="dashboard-post-card__actions">
                  <button type="button" className="button button-secondary" onClick={() => startEditMode(post)}>
                    Open review
                  </button>
                </div>
              </article>
            ))}
            {!pendingReviewPosts.length ? <p className="empty-state">No posts are waiting for approval right now.</p> : null}
          </div>
        </section>
      ) : null}

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
                {Array.isArray(resultCard.details) && resultCard.details.length ? (
                  <ul className="editor-status-card__details">
                    {resultCard.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
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
                <button
                  type="button"
                  className="markdown-tool"
                  onClick={() => inlineImageInputRef.current?.click()}
                  disabled={inlineImageBusy}
                >
                  {inlineImageBusy ? "Uploading image..." : "Add image"}
                </button>
                <button
                  type="button"
                  className="markdown-tool"
                  onClick={() => setShowPreview((current) => !current)}
                >
                  {showPreview ? "Hide preview" : "Show preview"}
                </button>
              </div>
              <input
                ref={inlineImageInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleInlineImageUpload}
              />
              <textarea
                ref={contentRef}
                name="content"
                rows="14"
                placeholder="Write your post in Markdown. Use ## main headings, ### subheadings, **bold**, *italic*, clean spacing, and plain Markdown only."
                value={draft.content}
                onChange={(event) => updateDraftField("content", event.target.value)}
                required
              />
              <span className="editor-form__hint">Use Markdown only. Keep one blank line between paragraphs, use ## and ### for headings, avoid HTML tags like &lt;p&gt; or &lt;br&gt;, and use Add image to place images inside the article body.</span>
            </label>

            {showPreview ? (
              <div className="editor-live-preview">
                <div className="editor-live-preview__header">
                  <strong>Live preview</strong>
                  <span>Markdown renders exactly like the public post page.</span>
                </div>
                <div className="editor-live-preview__body blog-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownPreviewComponents}>{previewContent}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="editor-live-preview editor-live-preview--compact">
                <div className="editor-live-preview__header">
                  <strong>Preview hidden</strong>
                  <span>Open it only when you want to inspect formatting before posting.</span>
                </div>
              </div>
            )}
          </div>

          <label>
            <span>Category</span>
            <select
              name="category"
              value={resolvedDraft.category}
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

          <div className="dashboard-warning dashboard-warning--soft">
            Only title, excerpt, and content are required for the fastest workflow. Century Blog now pre-fills SEO, author, image alt text, tags, and other editorial details automatically. Open advanced settings only when you want to override them.
          </div>

          <details
            className="editor-advanced"
            open={showAdvancedFields}
            onToggle={(event) => setShowAdvancedFields(event.currentTarget.open)}
          >
            <summary>Advanced SEO, source, and publishing settings</summary>

            {sourceWarningVisible ? (
              <p className="dashboard-warning">
                This looks like a sensitive story. Add at least one verified source link before you submit or publish it.
              </p>
            ) : null}

            <label>
              <span>Author</span>
              <input
                name="author"
                type="text"
                placeholder="Century Blog Editorial Team"
                value={resolvedDraft.author}
                onChange={(event) => updateDraftField("author", event.target.value)}
              />
            </label>

            <div className="editor-form__split">
              <label>
                <span>SEO title</span>
                <input
                  name="seoTitle"
                  type="text"
                  placeholder="Optional SEO title"
                  value={resolvedDraft.seoTitle}
                  onChange={(event) => updateDraftField("seoTitle", event.target.value)}
                />
              </label>
              <label>
                <span>Meta description</span>
                <textarea
                  name="metaDescription"
                  rows="3"
                  placeholder="Optional meta description"
                  value={resolvedDraft.metaDescription}
                  onChange={(event) => updateDraftField("metaDescription", event.target.value)}
                />
              </label>
            </div>

            <div className="editor-form__split">
              <label>
                <span>Tags</span>
                <input
                  name="tags"
                  type="text"
                  placeholder="politics, nigeria, economy"
                  value={resolvedDraft.tags}
                  onChange={(event) => updateDraftField("tags", event.target.value)}
                />
              </label>
              <label>
                <span>Featured image alt text</span>
                <input
                  name="imageAlt"
                  type="text"
                  placeholder="Describe the main image"
                  value={resolvedDraft.imageAlt}
                  onChange={(event) => updateDraftField("imageAlt", event.target.value)}
                />
              </label>
            </div>

            <div className="editor-form__split">
              <label>
                <span>Primary source name</span>
                <input
                  name="sourceName"
                  type="text"
                  placeholder="Reuters, WHO, CBN, Ministry of Health"
                  value={resolvedDraft.sourceName}
                  onChange={(event) => updateDraftField("sourceName", event.target.value)}
                />
              </label>
              <label>
                <span>Primary source link</span>
                <input
                  name="sourceUrl"
                  type="url"
                  placeholder="https://..."
                  value={resolvedDraft.sourceUrl}
                  onChange={(event) => updateDraftField("sourceUrl", event.target.value)}
                />
              </label>
            </div>

            <div className="editor-form__split">
              <label>
                <span>Source country</span>
                <input
                  name="sourceCountry"
                  type="text"
                  placeholder="Nigeria, United States, Global"
                  value={resolvedDraft.sourceCountry}
                  onChange={(event) => updateDraftField("sourceCountry", event.target.value)}
                />
              </label>
              <label>
                <span>Additional source links</span>
                <textarea
                  name="sourceLinks"
                  rows="4"
                  placeholder="Label|https://example.com&#10;Official statement|https://example.com/source"
                  value={resolvedDraft.sourceLinks}
                  onChange={(event) => updateDraftField("sourceLinks", event.target.value)}
                />
              </label>
            </div>

            {isAdmin ? (
              <div className="editor-form__split">
                <label>
                  <span>Workflow status</span>
                  <select
                    name="workflowStatusPreset"
                    value={submitMode}
                    onChange={(event) => setSubmitMode(event.target.value)}
                  >
                    <option value="draft">Save draft</option>
                    <option value="submit">Submit for review</option>
                    <option value="publish">Publish now</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
                <label>
                  <span>Schedule for</span>
                  <input
                    name="scheduledFor"
                    type="datetime-local"
                    value={resolvedDraft.scheduledFor}
                    onChange={(event) => updateDraftField("scheduledFor", event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            <label>
              <span>Review notes</span>
              <textarea
                name="reviewNotes"
                rows="3"
                placeholder="Optional editorial notes for approvals or revisions"
                value={resolvedDraft.reviewNotes}
                onChange={(event) => updateDraftField("reviewNotes", event.target.value)}
              />
            </label>
          </details>

          <label>
            <span>{draft.id ? "Replace image or video" : "Upload image or video"}</span>
            <input name="media" type="file" accept="image/*,video/*" onChange={handleFileChange} />
          </label>

          <p className="editor-form__hint">
            Upload one featured image or video. Images can be up to 8MB and videos up to 20MB. If you skip media, Century Blog will generate a branded cover so the post still looks complete across the homepage and article page.
          </p>

          {previewUrl ? (
            <div className="dashboard-preview">
              <div className="dashboard-preview__header">
                <strong>Media preview</strong>
                {previewName ? <span>{previewName}</span> : null}
              </div>
              {isVideoMedia(previewUrl, previewType) ? (
                <video className="dashboard-preview__media" controls preload="metadata" poster={previewPosterUrl || undefined}>
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
            <button type="submit" className="button button-primary" disabled={submitBusy} data-mode={submitMode}>
              {submitBusy
                ? "Saving..."
                : submitMode === "draft"
                  ? "Save draft"
                  : submitMode === "submit"
                    ? "Submit for review"
                    : submitMode === "scheduled"
                      ? "Save scheduled post"
                      : draft.id
                        ? "Save changes"
                        : "Publish post"}
            </button>
            {!isAdmin ? (
              <button type="submit" className="button button-secondary" data-mode="draft">
                Save as draft
              </button>
            ) : null}
            {draft.id ? (
              <button type="button" className="button button-secondary" onClick={startCreateMode}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <aside className="post-list-panel">
          <div className="editor-form__header">
            <h2>{isAdmin ? "Editorial posts" : "Your posts"}</h2>
            <p>
              {isAdmin
                ? "Review, edit, feature, and manage published, drafted, and submitted stories here. Auto-fetched posts remain clearly labelled."
                : "Create, update, and track your own drafts and submissions here."}
            </p>
          </div>

          <div className="filter-bar__chips filter-bar__chips--secondary">
            <button
              type="button"
              className={`filter-chip ${postListFilter === "all" ? "is-active" : ""}`}
              onClick={() => setPostListFilter("all")}
            >
              All posts ({postTypeCounts.all})
            </button>
            <button
              type="button"
              className={`filter-chip ${postListFilter === "manual" ? "is-active" : ""}`}
              onClick={() => setPostListFilter("manual")}
            >
              Manual ({postTypeCounts.manual})
            </button>
            <button
              type="button"
              className={`filter-chip ${postListFilter === "auto" ? "is-active" : ""}`}
              onClick={() => setPostListFilter("auto")}
            >
              Auto ({postTypeCounts.auto})
            </button>
            {canReview ? (
              <button
                type="button"
                className={`filter-chip ${postListFilter === "review" ? "is-active" : ""}`}
                onClick={() => setPostListFilter("review")}
              >
                Pending review ({pendingReviewPosts.length})
              </button>
            ) : null}
          </div>

          <div className="dashboard-post-list">
            {visiblePosts.map((post) => {
              const cardMedia = getDisplayMedia(post, "card");

              return (
              <article key={post.slug} className="dashboard-post-card">
                <div className="dashboard-post-card__media-wrap">
                  {isVideoMedia(cardMedia.url, cardMedia.type) ? (
                    <video className="dashboard-post-card__media" muted playsInline preload="metadata" poster={cardMedia.posterUrl || undefined}>
                      <source src={cardMedia.url} type={cardMedia.type} />
                    </video>
                  ) : isImageMedia(cardMedia.url, cardMedia.type) ? (
                    <img className="dashboard-post-card__media" src={cardMedia.url} alt={post.title} />
                  ) : null}
                </div>
                <div className="dashboard-post-card__labels">
                  <span className="pill">{getCategoryMeta(post.category).label}</span>
                  <span className={`pill pill-type pill-type--${post.type || "manual"}`}>{getPostTypeMeta(post.type || "manual").label}</span>
                  <span className="pill">{getWorkflowStatusMeta(post.workflowStatus || "published").label}</span>
                  {!post.originalMediaUrl && !post.mediaUrl ? <span className="pill">Generated cover</span> : null}
                  {post.featured ? <span className="pill pill-featured">Featured story</span> : null}
                </div>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <p className="dashboard-post-card__meta">
                  {(post.type || "manual") === "auto"
                    ? `Auto post${post.autoProvider ? ` via ${String(post.autoProvider).toUpperCase()}` : ""}${post.sourceName ? ` | Source: ${post.sourceName}` : ""}`
                    : post.sourceName
                      ? `Source: ${post.sourceName}`
                      : "Century Blog post"}
                </p>
                <div className="dashboard-post-card__actions">
                  {post.workflowStatus === "published" ? (
                    <a className="button button-secondary" href={getLivePostPath(post)} target="_blank" rel="noreferrer">
                      View live
                    </a>
                  ) : null}
                  {isAdmin ? (
                    <button
                      type="button"
                      className={`button ${post.featured ? "button-primary" : "button-secondary"}`}
                      onClick={() => handleSetFeatured(post.id)}
                      disabled={post.featured || settingsBusy || post.workflowStatus !== "published"}
                    >
                      {activeAction === "feature" && activePostId === String(post.id)
                        ? "Setting featured..."
                        : post.featured
                          ? "Featured story"
                          : "Set as featured"}
                    </button>
                  ) : null}
                  <button type="button" className="button button-secondary" onClick={() => startEditMode(post)}>
                    Edit
                  </button>
                  {isAdmin ? (
                    <button type="button" className="button button-secondary" onClick={() => handleDelete(post.id)} disabled={settingsBusy}>
                      {activeAction === "delete" && activePostId === String(post.id) ? "Deleting..." : "Delete"}
                    </button>
                  ) : null}
                </div>
              </article>
              );
            })}
            {!visiblePosts.length ? <p className="empty-state">No posts matched this dashboard filter.</p> : null}
          </div>
        </aside>
      </div>

      {canManageUsers ? (
        <section className="section-card automation-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Moderator Management</span>
              <h2>Team accounts and permissions</h2>
            </div>
            <p>Create, update, suspend, or soft-disable editorial accounts while keeping the super admin protected.</p>
          </div>

          <form className="editor-form" onSubmit={handleUserSubmit}>
            <div className="editor-form__split">
              <label>
                <span>Name</span>
                <input value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <label>
                <span>Email</span>
                <input type="email" value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} required />
              </label>
            </div>
            <div className="editor-form__split">
              <label>
                <span>Username</span>
                <input value={userForm.username} onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))} required />
              </label>
              <label>
                <span>Password {userForm.id ? "(leave blank to keep current)" : ""}</span>
                <input type="password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} />
              </label>
            </div>
            <div className="editor-form__split">
              <label>
                <span>Role</span>
                <select value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                  <option value="editor">Editor</option>
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={userForm.status} onChange={(event) => setUserForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="deleted">Soft deleted</option>
                </select>
              </label>
            </div>
            <div className="editor-form__actions">
              <button type="submit" className="button button-primary" disabled={settingsBusy}>
                {userForm.id ? "Update account" : "Add moderator"}
              </button>
              {userForm.id ? (
                <button type="button" className="button button-secondary" onClick={() => setUserForm({ id: "", name: "", email: "", username: "", role: "moderator", status: "active", password: "" })}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>

          <div className="dashboard-post-list">
            {!usersLoaded ? <p className="empty-state">Loading team accounts...</p> : null}
            {usersLoaded ? users.map((user) => (
              <article key={user.id} className="dashboard-post-card">
                <div className="dashboard-post-card__labels">
                  <span className="pill">{String(user.role || "").replace(/_/g, " ")}</span>
                  <span className="pill">{user.status}</span>
                </div>
                <h3>{user.name || user.username}</h3>
                <p>{user.email}</p>
                <p className="dashboard-post-card__meta">
                  Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-NG") : "Never"} | Posts created: {user.postsCreated || 0} | Approved: {user.postsApproved || 0} | Rejected: {user.postsRejected || 0}
                </p>
                {user.id !== "env-super-admin" ? (
                  <div className="dashboard-post-card__actions">
                    <button type="button" className="button button-secondary" onClick={() => startUserEdit(user)}>
                      Edit account
                    </button>
                  </div>
                ) : null}
              </article>
            )) : null}
          </div>
        </section>
      ) : null}

      {canManageUsers ? (
        <section className="section-card automation-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">Activity Log</span>
              <h2>Moderator and admin activity</h2>
            </div>
            <p>Search recent logins, article updates, approvals, role changes, and other editorial actions.</p>
          </div>
          <div className="editor-form__split">
            <label>
              <span>Search logs</span>
              <input value={logSearch} onChange={(event) => setLogSearch(event.target.value)} placeholder="search by action, post, or user" />
            </label>
            <div className="editor-form__actions" style={{ alignSelf: "end" }}>
              <button type="button" className="button button-secondary" onClick={() => refreshLogs()}>
                {logsLoaded ? "Refresh logs" : "Load logs"}
              </button>
            </div>
          </div>
          <div className="dashboard-post-list">
            {!logsLoaded ? <p className="empty-state">Activity logs load only when requested, so the dashboard opens faster.</p> : null}
            {logsLoaded ? activityLogs.map((log) => (
              <article key={log.id} className="dashboard-post-card">
                <div className="dashboard-post-card__labels">
                  <span className="pill">{log.status}</span>
                </div>
                <h3>{log.action}</h3>
                <p>{log.userName} {log.userRole ? `(${log.userRole})` : ""}</p>
                <p className="dashboard-post-card__meta">
                  {new Date(log.createdAt).toLocaleString("en-NG")} {log.entityType ? `| ${log.entityType}` : ""} {log.entityId ? `| ${log.entityId}` : ""}
                </p>
              </article>
            )) : null}
            {logsLoaded && !activityLogs.length ? <p className="empty-state">No activity logs matched your search yet.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
