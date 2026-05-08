import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { publishAutoDraft } from "@/lib/auto-drafts-store";

async function requireAdmin() {
  const cookieStore = await cookies();
  return isAdminAuthenticated(cookieStore.get("century_admin_session")?.value);
}

export async function POST(_request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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
