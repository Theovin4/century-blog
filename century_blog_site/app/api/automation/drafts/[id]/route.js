import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { deleteAutoDraft } from "@/lib/auto-drafts-store";

async function requireAdmin() {
  const cookieStore = await cookies();
  return isAdminAuthenticated(cookieStore.get("century_admin_session")?.value);
}

export async function DELETE(_request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteAutoDraft(id);

  if (!deleted) {
    return NextResponse.json({ message: "Draft not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
