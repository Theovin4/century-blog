import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAutomationProviderSummary } from "@/lib/auto-news";
import { getAutomationSettings, updateAutomationSettings } from "@/lib/automation-store";

async function requireAdmin() {
  const cookieStore = await cookies();
  return isAdminAuthenticated(cookieStore.get("century_admin_session")?.value);
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [settings, providers] = await Promise.all([
    getAutomationSettings(),
    Promise.resolve(getAutomationProviderSummary())
  ]);

  return NextResponse.json({ settings, providers });
}

export async function PATCH(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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
