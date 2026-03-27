import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { discoverySchema } from "@/lib/schema/discovery";
import { getRedis } from "@/lib/storage/redis";

export async function POST(request: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      {
        error:
          "Team links are not configured. Add Upstash Redis from Vercel Marketplace and set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = discoverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload did not match the discovery schema.", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const id = nanoid(12);
  await redis.set(`discovery:${id}`, JSON.stringify(parsed.data));
  return NextResponse.json({ id });
}
