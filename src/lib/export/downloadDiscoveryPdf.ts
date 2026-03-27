import { jsPDF } from "jspdf";
import type { DiscoveryPayload } from "@/lib/schema/discovery";

function safeFilename(title: string): string {
  const base = title.trim() || "discovery";
  return `${base.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "discovery"}.pdf`;
}

/**
 * Builds a printable PDF summary matching the former PrintSummary layout.
 */
export function downloadDiscoveryPdf(data: DiscoveryPayload): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const maxW = pageW - margin * 2;
  let y = 20;
  const bodySize = 10;
  const smallSize = 9;
  const lineGap = 5;
  const sectionGap = 4;

  const newPageIfNeeded = (neededMm: number) => {
    if (y + neededMm > pageH - 14) {
      doc.addPage();
      y = 20;
    }
  };

  const addLines = (text: string, size = bodySize) => {
    const t = text.trim();
    if (!t) return;
    doc.setFontSize(size);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(t, maxW);
    for (const line of lines) {
      newPageIfNeeded(lineGap + 2);
      doc.text(line, margin, y);
      y += lineGap;
    }
    y += 2;
  };

  const addHeading = (title: string, size = 12) => {
    newPageIfNeeded(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.text(title, margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
  };

  const addLabelBlock = (label: string, value: string | undefined) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(smallSize);
    newPageIfNeeded(8);
    doc.text(label, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    addLines(value || "—", smallSize);
    y += sectionGap;
  };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.meta.title, margin, y);
  y += 10;
  doc.setFontSize(smallSize);
  doc.setFont("helvetica", "normal");
  const subtitle = [data.meta.clientOrg, data.meta.date].filter(Boolean).join(" · ");
  if (subtitle) {
    doc.text(subtitle, margin, y);
    y += 8;
  } else {
    y += 4;
  }

  addHeading("Who and why", 14);
  if (data.meta.stakeholders?.trim()) {
    addLines(data.meta.stakeholders);
  }
  addLines(data.meta.painAndOutcome);
  if (data.meta.facilitatorNotes?.trim()) {
    doc.setFont("helvetica", "italic");
    addLines(`Facilitator notes: ${data.meta.facilitatorNotes}`);
    doc.setFont("helvetica", "normal");
  }
  y += sectionGap;

  addHeading("Systems", 14);
  for (const s of data.systems) {
    const parts = [
      `${s.name} (${s.role})`,
      s.deployment,
      s.owner ? `Owner: ${s.owner}` : "",
      s.adminAccess ? `Admin access: ${s.adminAccess}` : "",
    ].filter(Boolean);
    addLines(`• ${parts.join(" — ")}`);
  }
  y += sectionGap;

  addHeading("Wrike specifics", 14);
  addLabelBlock("Spaces / folders", data.wrike.spacesFolders);
  addLabelBlock("Item types", data.wrike.itemTypes);
  addLabelBlock("Custom fields", data.wrike.customFields);
  addLabelBlock("Permissions", data.wrike.permissions);

  addHeading("Pattern", 14);
  addLines(`Tool: ${data.pattern.tool}`);
  if (data.pattern.existingRefs?.trim()) {
    addLines(data.pattern.existingRefs);
  }
  y += sectionGap;

  addHeading("Flows", 14);
  data.flows.forEach((f, i) => {
    addHeading(`${i + 1}. ${f.fromSystem} → ${f.toSystem} (${f.direction})`, 11);
    addLines(f.objects);
    const bits = [
      `When: ${f.trigger}`,
      f.triggerDetail?.trim(),
      f.frequency ? `How often: ${f.frequency}` : "",
      f.volumeEstimate ? `Volume: ${f.volumeEstimate}` : "",
    ].filter(Boolean);
    addLines(bits.join(" · "));
    y += 2;
  });

  addHeading("Data rules", 14);
  addLabelBlock("Identity / matching", data.dataRules.identity);
  addLabelBlock("Deduping", data.dataRules.deduping);
  addLabelBlock("Deletes", data.dataRules.deletes);
  addLabelBlock("Confidential fields", data.dataRules.confidential);

  addHeading("Operations", 14);
  addLabelBlock("Monitoring", data.operations.monitoring);
  addLabelBlock("Support owner", data.operations.supportOwner);
  addLabelBlock("Rollback", data.operations.rollback);
  addLabelBlock("Go-live window", data.operations.goLive);
  if (data.openQuestions?.trim()) {
    addHeading("Open questions", 12);
    addLines(data.openQuestions);
  }

  doc.save(safeFilename(data.meta.title));
}
