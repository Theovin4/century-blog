import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAutoDrafts } from "@/lib/auto-drafts-store";

async function requireAdmin() {
  const cookieStore = await cookies();
  return isAdminAuthenticated(cookieStore.get("century_admin_session")?.value);
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const drafts = await getAutoDrafts();
  return NextResponse.json(drafts);
}
