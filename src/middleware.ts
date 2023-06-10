import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const upstashRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!upstashRedisUrl || !upstashRedisToken) {
  throw new Error("Missing Upstash Redis variables in .env.local file");
}

const redisClient = new Redis({
  url: upstashRedisUrl,
  token: upstashRedisToken,
});

const maxAllowedRequests = 3;
const requestsDurationWindow = "1 m";

const rateLimiter = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.slidingWindow(maxAllowedRequests, requestsDurationWindow),
});

const getClientIp = (request: NextRequest) => {
  let ip = request.ip ?? request.headers.get("x-real-ip");
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? null;
    return ip;
  }
  return ip;
};

export async function middleware(request: NextRequest) {
  const identifier = getClientIp(request);

  if (identifier) {
    const result = await rateLimiter.limit(identifier);
    if (!result.success) {
      return NextResponse.json(
        { error: `Too many requests, please try again later` },
        { status: 429 }
      );
    }
  }
}

// Match All paths starting with /api
export const config = {
  matcher: ["/api/:path*"],
};
