import { NextResponse } from "next/server";
import { deleteAutoDraft } from "@/lib/auto-drafts-store";
import { getCurrentUser, hasPermission } from "@/lib/editorial";

async function requireAdmin() {
  return getCurrentUser();
}

export async function DELETE(_request, { params }) {
  const user = await requireAdmin();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "articles:review")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const deleted = await deleteAutoDraft(id);

  if (!deleted) {
    return NextResponse.json({ message: "Draft not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
