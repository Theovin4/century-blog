import { NextResponse } from "next/server";
import { getAutomationProviderSummary } from "@/lib/auto-news";
import { getAutomationSettings, updateAutomationSettings } from "@/lib/automation-store";
import { getCurrentUser, hasPermission } from "@/lib/editorial";
import { requireTrustedWriteOrigin } from "@/lib/request-security";

async function requireAdmin() {
  return getCurrentUser();
}

export async function GET() {
  const user = await requireAdmin();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "articles:settings")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const [settings, providers] = await Promise.all([
    getAutomationSettings(),
    Promise.resolve(getAutomationProviderSummary())
  ]);

  return NextResponse.json({ settings, providers });
}

export async function PATCH(request) {
  const originError = requireTrustedWriteOrigin(request);
  if (originError) {
    return originError;
  }

  const user = await requireAdmin();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "articles:settings")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const patch = {};

  if (typeof body.autoPostingEnabled === "boolean") {
    patch.autoPostingEnabled = body.autoPostingEnabled;
  }

  if (body.maxPostsPerRun !== undefined) {
    patch.maxPostsPerRun = body.maxPostsPerRun;
  }

  if (body.fetchIntervalHours !== undefined) {
    patch.fetchIntervalHours = body.fetchIntervalHours;
  }

  if (body.nigeriaShareTarget !== undefined) {
    patch.nigeriaShareTarget = body.nigeriaShareTarget;
  }

  if (body.globalShareTarget !== undefined) {
    patch.globalShareTarget = body.globalShareTarget;
  }

  const next = await updateAutomationSettings(patch);

  return NextResponse.json({ settings: next, providers: getAutomationProviderSummary() });
}
