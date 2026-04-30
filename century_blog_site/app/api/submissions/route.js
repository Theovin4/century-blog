import { NextResponse } from "next/server";
import { createSubmission } from "@/lib/submissions-store";
import { getSubstackSubscribeUrl } from "@/lib/site";
import { applyRateLimit, getRequestIp } from "@/lib/rate-limit";

export async function POST(request) {
  const ip = getRequestIp(request);
  const rateLimit = applyRateLimit({
    bucket: "submissions",
    key: ip,
    limit: 10,
    windowMs: 10 * 60 * 1000
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many submissions right now. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000))
        }
      }
    );
  }

  const body = await request.json().catch(() => ({}));
  const type = String(body?.type || "").trim();
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim();
  const message = String(body?.message || "").trim();

  if (!type || !email) {
    return NextResponse.json({ message: "Type and email are required." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  if (name.length > 100 || message.length > 4000) {
    return NextResponse.json({ message: "Your submission is too long." }, { status: 400 });
  }

  if (type === "contact" && !message) {
    return NextResponse.json({ message: "Message is required for contact submissions." }, { status: 400 });
  }

  const submission = await createSubmission({ type, name, email, message });
  let destination = "local";

  if (type === "newsletter") {
    const substackSubscribeUrl = getSubstackSubscribeUrl();

    if (substackSubscribeUrl) {
      try {
        await fetch(substackSubscribeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({ email })
        });
        destination = "substack";
      } catch {
        destination = "local";
      }
    }
  }

  return NextResponse.json({ ...submission, destination }, { status: 201 });
}
