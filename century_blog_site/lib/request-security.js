import { NextResponse } from "next/server";

function normalizeOrigin(value) {
  try {
    return new URL(String(value || "")).origin;
  } catch {
    return "";
  }
}

function getTrustedOrigins(request) {
  const trusted = new Set();
  const requestOrigin = normalizeOrigin(request?.nextUrl?.origin || "");
  const configuredSiteOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL || "");

  if (requestOrigin) {
    trusted.add(requestOrigin);
  }

  if (configuredSiteOrigin) {
    trusted.add(configuredSiteOrigin);
  }

  return trusted;
}

export function requireTrustedWriteOrigin(request, { allowMissing = false } = {}) {
  const origin = normalizeOrigin(request.headers.get("origin"));
  const referer = normalizeOrigin(request.headers.get("referer"));

  if (!origin && !referer) {
    return allowMissing ? null : NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const trustedOrigins = getTrustedOrigins(request);
  const candidate = origin || referer;

  if (!trustedOrigins.has(candidate)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return null;
}

export function validateStrongPassword(password) {
  const value = String(password || "");

  if (value.length < 12) {
    return "Password must be at least 12 characters long.";
  }

  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return "Password must include uppercase, lowercase, and at least one number.";
  }

  return "";
}

