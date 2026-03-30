export const TRANSCRIPT_IMPORT_SYSTEM = `You are extracting structured data for an integration discovery worksheet (Wrike, Workato, Unito context).

Rules:
- Output must match the provided schema exactly. Use enum values only where specified.
- system role: hub | source | destination | bidirectional
- deployment: saas | onprem | unknown
- adminAccess when unknown: use "unknown"
- pattern.tool: workato | unito | both | unknown
- flow trigger: event | schedule | manual | other
- flow direction: one_way | bidirectional
- Do not invent sensitive personal data. Prefer paraphrasing what was said.
- If the transcript does not mention something, use empty strings for optional fields.
- Required strings (title, clientOrg, painAndOutcome, system names, flow endpoints, flow objects) must be non-empty: infer short sensible text from context when possible. If impossible, use a minimal placeholder like "TBD" only for title or clientOrg, never for flow object descriptions—summarize what you can from the call.
- Include at least one system and one flow when anything integration-related was discussed; otherwise one system "Wrike" hub and one minimal flow if the call was only about Wrike.
- Combine multiple integration connections as multiple entries in flows.`;

export function buildTranscriptUserPrompt(transcript: string): string {
  return `Read this call transcript and fill the discovery object.

Transcript:
---
${transcript}
---
`;
}
