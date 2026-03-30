import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { discoverySchema } from "@/lib/schema/discovery";
import {
  TRANSCRIPT_IMPORT_SYSTEM,
  buildTranscriptUserPrompt,
} from "@/lib/prompts/transcriptImport";
import { stripVttCues } from "@/lib/transcript/stripVtt";

const MAX_TRANSCRIPT_CHARS = 100_000;

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "OpenAI is not configured. Set OPENAI_API_KEY in your environment (e.g. Vercel project settings).",
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

  const transcriptRaw =
    typeof body === "object" &&
    body !== null &&
    "transcript" in body &&
    typeof (body as { transcript: unknown }).transcript === "string"
      ? (body as { transcript: string }).transcript
      : null;

  if (!transcriptRaw || !transcriptRaw.trim()) {
    return NextResponse.json(
      { error: "Missing or empty \"transcript\" string." },
      { status: 400 }
    );
  }

  const cleaned = stripVttCues(transcriptRaw);
  if (cleaned.length > MAX_TRANSCRIPT_CHARS) {
    return NextResponse.json(
      {
        error: `Transcript is too long (max ${MAX_TRANSCRIPT_CHARS} characters after cleaning).`,
      },
      { status: 400 }
    );
  }

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: discoverySchema,
      schemaName: "DiscoveryPayload",
      schemaDescription:
        "Integration discovery worksheet: meta, systems, Wrike fields, pattern, flows, data rules, operations",
      system: TRANSCRIPT_IMPORT_SYSTEM,
      prompt: buildTranscriptUserPrompt(cleaned),
      temperature: 0.2,
    });

    const validated = discoverySchema.safeParse(object);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Model output failed validation.",
          issues: validated.error.flatten(),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: validated.data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
