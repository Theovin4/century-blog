import { NextResponse } from "next/server";
import { createSubmission } from "@/lib/submissions-store";

export async function POST(request) {
  const body = await request.json();
  const type = String(body?.type || "").trim();
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim();
  const message = String(body?.message || "").trim();

  if (!type || !email) {
    return NextResponse.json({ message: "Type and email are required." }, { status: 400 });
  }

  if (type === "contact" && !message) {
    return NextResponse.json({ message: "Message is required for contact submissions." }, { status: 400 });
  }

  const submission = await createSubmission({ type, name, email, message });
  return NextResponse.json(submission, { status: 201 });
}
