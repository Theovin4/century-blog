import path from "node:path";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const localFilePath = path.join(process.cwd(), "data", "automation-settings.json");
const publicId = "century-blog/data/automation-settings";

const defaultSettings = {
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

function normalizeSettings(settings) {
  return {
    ...defaultSettings,
    ...(settings && typeof settings === "object" ? settings : {}),
    autoPostingEnabled: settings?.autoPostingEnabled !== false,
    fetchIntervalHours: Math.max(1, Number(settings?.fetchIntervalHours || defaultSettings.fetchIntervalHours)),
    nigeriaShareTarget: Number(settings?.nigeriaShareTarget || defaultSettings.nigeriaShareTarget),
    globalShareTarget: Number(settings?.globalShareTarget || defaultSettings.globalShareTarget),
    maxPostsPerRun: Math.max(1, Number(settings?.maxPostsPerRun || defaultSettings.maxPostsPerRun)),
    lastRunAt: String(settings?.lastRunAt || ""),
    lastRunStatus: String(settings?.lastRunStatus || "idle"),
    lastRunMessage: String(settings?.lastRunMessage || ""),
    lastPublishedCount: Math.max(0, Number(settings?.lastPublishedCount || 0))
  };
}

export async function getAutomationSettings() {
  const settings = await readJsonStore(localFilePath, publicId, defaultSettings);
  return normalizeSettings(settings);
}

export async function updateAutomationSettings(patch) {
  const current = await getAutomationSettings();
  const next = normalizeSettings({
    ...current,
    ...(patch && typeof patch === "object" ? patch : {})
  });

  await writeJsonStore(localFilePath, publicId, next);
  return next;
}

export async function markAutomationRun(result) {
  return updateAutomationSettings({
    lastRunAt: new Date().toISOString(),
    lastRunStatus: result?.status || "idle",
    lastRunMessage: result?.message || "",
    lastPublishedCount: Number(result?.publishedCount || 0)
  });
}
