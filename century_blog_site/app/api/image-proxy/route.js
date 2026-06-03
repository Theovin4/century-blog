import { NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_PORTS = new Set(["", "80", "443"]);

function isPrivateHostname(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return normalized === "localhost" || normalized.endsWith(".local");
}

function isPrivateIpAddress(address) {
  const version = net.isIP(address);

  if (version === 4) {
    return (
      address.startsWith("10.") ||
      address.startsWith("127.") ||
      address.startsWith("192.168.") ||
      address.startsWith("169.254.") ||
      address.startsWith("0.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(address) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address)
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.") ||
      /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    );
  }

  return false;
}

async function isSafeRemoteHost(hostname) {
  if (!hostname || isPrivateHostname(hostname)) {
    return false;
  }

  try {
    const results = await dns.lookup(hostname, { all: true });
    return results.length > 0 && results.every((entry) => !isPrivateIpAddress(entry.address));
  } catch {
    return false;
  }
}

function isSafeImageUrl(value) {
  try {
    const target = new URL(String(value || ""));
    return ALLOWED_PROTOCOLS.has(target.protocol) && ALLOWED_PORTS.has(target.port);
  } catch {
    return false;
  }
}

export async function GET(request) {
  const target = request.nextUrl.searchParams.get("url") || "";

  if (!isSafeImageUrl(target)) {
    return NextResponse.json({ message: "Invalid image URL." }, { status: 400 });
  }

  const parsed = new URL(target);

  if (!(await isSafeRemoteHost(parsed.hostname))) {
    return NextResponse.json({ message: "Blocked image host." }, { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": "CenturyBlogImageProxy/1.0"
      },
      cache: "no-store"
    });

    if (!upstream.ok) {
      return NextResponse.json({ message: "Unable to fetch image." }, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") || "";

    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ message: "URL did not return an image." }, { status: 415 });
    }

    const body = await upstream.arrayBuffer();

    if (body.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json({ message: "Image is too large to proxy safely." }, { status: 413 });
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
      }
    });
  } catch {
    return NextResponse.json({ message: "Image proxy failed." }, { status: 502 });
  }
}
