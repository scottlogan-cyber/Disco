import { describe, expect, it } from "vitest";
import { stripVttCues } from "./stripVtt";

describe("stripVttCues", () => {
  it("passes through plain text", () => {
    expect(stripVttCues("Just a note")).toBe("Just a note");
  });

  it("strips WEBVTT header and timing lines", () => {
    const raw = `WEBVTT

00:00:01.000 --> 00:00:03.500
Hello from the call

00:00:04.000 --> 00:00:05.000
Second line
`;
    const out = stripVttCues(raw);
    expect(out).toContain("Hello from the call");
    expect(out).toContain("Second line");
    expect(out.toUpperCase()).not.toContain("WEBVTT");
  });
});
