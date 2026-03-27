import { NextResponse } from "next/server";
import { discoverySchema } from "@/lib/schema/discovery";
import { getRedis } from "@/lib/storage/redis";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Team storage is not configured." }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const raw = await redis.get<string>(`discovery:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let data: unknown;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return NextResponse.json({ error: "Stored data was corrupted." }, { status: 500 });
  }

  const parsed = discoverySchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Stored data is invalid." }, { status: 500 });
  }

  return NextResponse.json(parsed.data);
}

export async function PATCH(request: Request, context: RouteContext) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Team storage is not configured." }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
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

  const exists = await redis.exists(`discovery:${id}`);
  if (!exists) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await redis.set(`discovery:${id}`, JSON.stringify(parsed.data));
  return NextResponse.json({ ok: true });
}
