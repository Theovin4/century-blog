import { NextResponse } from "next/server";
import { getAutoDrafts } from "@/lib/auto-drafts-store";
import { getCurrentUser, hasPermission } from "@/lib/editorial";

async function requireAdmin() {
  return getCurrentUser();
}

export async function GET() {
  const user = await requireAdmin();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "articles:review")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const drafts = await getAutoDrafts();
  return NextResponse.json(drafts);
}
