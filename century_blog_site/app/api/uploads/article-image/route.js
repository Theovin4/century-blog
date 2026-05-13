import { NextResponse } from "next/server";
import {
  getPersistentStorageErrorMessage,
  isCloudinaryConfigured,
  isPersistentStorageReady,
  uploadMediaFile
} from "@/lib/cloudinary";
import { getCurrentUser, hasPermission, logActivity } from "@/lib/editorial";
import { slugify } from "@/lib/site";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

export async function POST(request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "articles:create")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!isPersistentStorageReady() || !isCloudinaryConfigured()) {
    return NextResponse.json({ message: getPersistentStorageErrorMessage() }, { status: 503 });
  }

  const formData = await request.formData();
  const image = formData.get("image");

  if (!image || typeof image === "string") {
    return NextResponse.json({ message: "Choose an image to upload." }, { status: 400 });
  }

  if (!String(image.type || "").startsWith("image/")) {
    return NextResponse.json({ message: "Only image uploads are supported inside article content." }, { status: 400 });
  }

  if (image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ message: "Inline article images must be 8MB or smaller." }, { status: 400 });
  }

  try {
    const upload = await uploadMediaFile(
      image,
      slugify(image.name?.replace(/\.[a-z0-9]+$/i, "") || `article-image-${Date.now()}`) || `article-image-${Date.now()}`
    );

    await logActivity(request, user, {
      action: "article.inline-image-uploaded",
      entityType: "media",
      entityId: upload.originalMediaUrl || upload.mediaUrl,
      status: "success",
      details: {
        mediaName: upload.mediaName,
        mediaType: upload.mediaType
      }
    });

    return NextResponse.json({
      ok: true,
      url: upload.originalMediaUrl || upload.mediaUrl,
      optimizedUrl: upload.mediaUrl,
      alt: image.name?.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Article image"
    });
  } catch (error) {
    return NextResponse.json({ message: error.message || "Unable to upload article image." }, { status: 500 });
  }
}
