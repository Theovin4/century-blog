const buckets = globalThis.__centuryRateLimitBuckets || new Map();

globalThis.__centuryRateLimitBuckets = buckets;

export function applyRateLimit({ bucket, key, limit, windowMs }) {
  const now = Date.now();
  const bucketKey = `${bucket}:${key}`;
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs
    });

    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterMs: windowMs
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, current.resetAt - now)
    };
  }

  current.count += 1;
  buckets.set(bucketKey, current);

  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    retryAfterMs: Math.max(0, current.resetAt - now)
  };
}

export function getRequestIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
