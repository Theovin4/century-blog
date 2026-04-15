import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { createPost, getPosts } from "@/lib/posts-store";
import {
  getPersistentStorageErrorMessage,
  isCloudinaryConfigured,
  isPersistentStorageReady
} from "@/lib/cloudinary";
import { inferMediaType, isValidCategory } from "@/lib/site";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;

function validateMedia(media) {
  const mediaType = media.type || inferMediaType(media.name);
  const isImage = mediaType.startsWith("image/");
  const isVideo = mediaType.startsWith("video/");

  if (!isImage && !isVideo) {
    return "Only image and video uploads are supported.";
  }

  if (isImage && media.size > MAX_IMAGE_SIZE) {
    return "Images must be 2MB or smaller.";
  }

  if (isVideo && media.size > MAX_VIDEO_SIZE) {
    return "Videos must be 20MB or smaller.";
  }

  return "";
}

function revalidatePostSurfaces(post) {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/sitemap.xml");
  revalidatePath(`/category/${post.category}`);
  revalidatePath(`/news/${post.slug}`);
}

export async function GET() {
  const posts = await getPosts();
  return NextResponse.json(posts);
}

export async function POST(request) {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminAuthenticated(cookieStore.get("century_admin_session")?.value);

  if (!isAuthenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!isPersistentStorageReady()) {
    return NextResponse.json({ message: getPersistentStorageErrorMessage() }, { status: 503 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const author = String(formData.get("author") || "").trim();
  const media = formData.get("media");

  if (!title || !excerpt || !content || !category) {
    return NextResponse.json(
      { message: "Title, excerpt, content, and category are required." },
      { status: 400 }
    );
  }

  if (title.length > 140 || excerpt.length > 280 || content.length > 20000) {
    return NextResponse.json({ message: "Post content is too long." }, { status: 400 });
  }

  if (!isValidCategory(category)) {
    return NextResponse.json({ message: "Choose a valid category." }, { status: 400 });
  }

  if (media && typeof media !== "string" && media.size > 0) {
    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ message: getPersistentStorageErrorMessage() }, { status: 503 });
    }

    const mediaError = validateMedia(media);
    if (mediaError) {
      return NextResponse.json({ message: mediaError }, { status: 400 });
    }
  }

  try {
    const post = await createPost(
      {
        title,
        excerpt,
        content,
        category,
        author
      },
      media && typeof media !== "string" && media.size > 0 ? media : null
    );

    revalidatePostSurfaces(post);
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error.message || "Unable to create post." }, { status: 500 });
  }
}




