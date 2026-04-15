import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { runAutomatedNewsIngestion } from "@/lib/auto-news";

async function isAllowedByAdmin() {
  const cookieStore = await cookies();
  return isAdminAuthenticated(cookieStore.get("century_admin_session")?.value);
}

function isAllowedBySecret(request) {
  const secret = process.env.CRON_SECRET || process.env.AUTO_NEWS_CRON_SECRET || "";

  if (!secret) {
    return false;
  }

  return request.headers.get("x-cron-secret") === secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handleRun(request, force = false) {
  const isAdmin = await isAllowedByAdmin();
  const isSecretAllowed = isAllowedBySecret(request);

  if (!isAdmin && !isSecretAllowed) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAutomatedNewsIngestion({ force: force || isAdmin });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error.message || "Automation run failed." }, { status: 500 });
  }
}

export async function POST(request) {
  return handleRun(request, true);
}

export async function GET(request) {
  return handleRun(request, false);
}
