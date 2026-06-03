import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { publishAutoDraft } from "@/lib/auto-drafts-store";
import { getCurrentUser, hasPermission } from "@/lib/editorial";
import { requireTrustedWriteOrigin } from "@/lib/request-security";

async function requireAdmin() {
  return getCurrentUser();
}

export async function POST(_request, { params }) {
  const originError = requireTrustedWriteOrigin(_request);
  if (originError) {
    return originError;
  }

  const user = await requireAdmin();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "articles:review")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const post = await publishAutoDraft(id);

  if (!post) {
    return NextResponse.json({ message: "Draft not found." }, { status: 404 });
  }

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/dashboard");
  revalidatePath("/sitemap.xml");
  revalidatePath(`/category/${post.category}`);
  revalidatePath(`/news/${post.slug}`);

  return NextResponse.json(post);
}
