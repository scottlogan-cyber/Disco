"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import NucleusScene from "@/components/visual/NucleusScene";
import { downloadDiscoveryPdf } from "@/lib/export/downloadDiscoveryPdf";
import {
  defaultDiscoveryPayload,
  discoverySchema,
  DISCOVERY_STEP_FIELDS,
  DISCOVERY_STEP_TITLES,
  type DiscoveryPayload,
} from "@/lib/schema/discovery";
import { buildGraphFromDiscovery } from "@/lib/graph/buildGraphFromDiscovery";
import {
  decodeHashToDiscovery,
  readHashFromWindow,
} from "@/lib/share/stateCodec";
import { useMediaReducedMotion } from "@/lib/hooks/useMediaReducedMotion";
import { useIsNarrowScreen } from "@/lib/hooks/useIsNarrowScreen";
import { stripVttCues } from "@/lib/transcript/stripVtt";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

export default function DiscoveryWizard() {
  const searchParams = useSearchParams();
  const remoteId = searchParams.get("id");

  const [step, setStep] = useState(0);
  const [shareError, setShareError] = useState<string | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(!!remoteId);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"form" | "preview">("form");
  const [transcriptPaste, setTranscriptPaste] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<DiscoveryPayload | null>(
    null
  );

  const reducedMotion = useMediaReducedMotion();
  const narrow = useIsNarrowScreen();

  const form = useForm<DiscoveryPayload>({
    resolver: zodResolver(discoverySchema),
    defaultValues: defaultDiscoveryPayload,
    mode: "onBlur",
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    trigger,
    getValues,
    formState: { errors, isDirty },
  } = form;

  const { fields: systemFields, append: appendSystem, remove: removeSystem } =
    useFieldArray({ control, name: "systems" });

  const { fields: flowFields, append: appendFlow, remove: removeFlow } =
    useFieldArray({ control, name: "flows" });

  const live = watch();
  const deferred = useDeferredValue(live);
  const graph = useMemo(
    () => buildGraphFromDiscovery(deferred),
    [deferred]
  );

  useEffect(() => {
    if (!remoteId) {
      setRemoteLoading(false);
      const hash = readHashFromWindow();
      if (!hash) return;
      const decoded = decodeHashToDiscovery(hash);
      if (decoded.ok) {
        reset(decoded.data);
        setShareError(null);
      } else {
        setShareError(decoded.error);
      }
      return;
    }

    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError(null);
    fetch(`/api/discoveries/${remoteId}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? "Could not load team discovery.");
        }
        return res.json() as Promise<DiscoveryPayload>;
      })
      .then((data) => {
        if (cancelled) return;
        reset(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setRemoteError(e.message);
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [remoteId, reset]);

  async function goNext() {
    const fields = DISCOVERY_STEP_FIELDS[step];
    if (fields.length > 0) {
      const ok = await trigger(fields as never);
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, DISCOVERY_STEP_TITLES.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function exportPdf() {
    const parsed = discoverySchema.safeParse(getValues());
    if (!parsed.success) {
      void trigger();
      return;
    }
    downloadDiscoveryPdf(parsed.data);
    setFeedbackMessage("PDF download started.");
    setTimeout(() => setFeedbackMessage(null), 3500);
  }

  function onTranscriptFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setTranscriptPaste(stripVttCues(text));
      setImportError(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function runTranscriptImport() {
    const raw = transcriptPaste.trim();
    if (!raw) {
      setImportError("Paste a transcript or upload a .txt / .vtt file.");
      return;
    }
    setImportLoading(true);
    setImportError(null);
    try {
      const res = await fetch("/api/discoveries/parse-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: stripVttCues(raw) }),
      });
      const j = (await res.json()) as { data?: DiscoveryPayload; error?: string };
      if (!res.ok) {
        throw new Error(j.error ?? "Could not extract from transcript.");
      }
      if (!j.data) {
        throw new Error("No data returned.");
      }
      setPendingImport(j.data);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImportLoading(false);
    }
  }

  function applyTranscriptImport() {
    if (!pendingImport) return;
    if (
      isDirty &&
      !window.confirm(
        "Replace your current answers with the imported discovery data?"
      )
    ) {
      return;
    }
    reset(pendingImport);
    setPendingImport(null);
    setTranscriptPaste("");
    setImportError(null);
    setStep(0);
    setFeedbackMessage("Form filled from transcript. Review and edit any page.");
    setTimeout(() => setFeedbackMessage(null), 4500);
  }

  if (remoteLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-24 text-muted">
        Loading discovery…
      </div>
    );
  }

  if (remoteError) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-foreground">{remoteError}</p>
        <Link
          href="/discovery"
          className="mt-6 inline-block rounded-full bg-accent px-6 py-2 text-sm font-medium text-white"
        >
          Start fresh
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="no-print border-b border-border bg-card/80 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-accent">
              Step {step + 1} of {DISCOVERY_STEP_TITLES.length}
            </p>
            <h1 className="text-lg font-semibold text-foreground">
              {DISCOVERY_STEP_TITLES[step]}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {DISCOVERY_STEP_TITLES.map((t, i) => (
              <button
                key={t}
                type="button"
                onClick={() => setStep(i)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  i === step
                    ? "bg-accent text-white"
                    : "bg-accent-soft text-foreground hover:bg-accent/15"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        {shareError ? (
          <p className="mx-auto mt-3 max-w-6xl text-sm text-accent">
            {shareError} You can still fill out a new discovery below.
          </p>
        ) : null}
        {feedbackMessage ? (
          <p className="mx-auto mt-3 max-w-6xl text-sm text-muted">{feedbackMessage}</p>
        ) : null}
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 lg:flex-row">
        <form
          className="no-print flex w-full flex-1 flex-col gap-6 lg:flex-row lg:items-start"
          onSubmit={handleSubmit(() => {})}
        >
          <section className="no-print flex-1 space-y-6 lg:max-w-xl">
            {narrow ? (
              <div className="flex rounded-full bg-accent-soft p-1 text-xs font-medium">
                <button
                  type="button"
                  className={`flex-1 rounded-full py-2 ${
                    previewTab === "form" ? "bg-card shadow-sm" : ""
                  }`}
                  onClick={() => setPreviewTab("form")}
                >
                  Questions
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-full py-2 ${
                    previewTab === "preview" ? "bg-card shadow-sm" : ""
                  }`}
                  onClick={() => setPreviewTab("preview")}
                >
                  Nucleus preview
                </button>
              </div>
            ) : null}

            <div className={`space-y-6 ${narrow && previewTab !== "form" ? "hidden" : ""}`}>
            {step === 0 && (
              <div className="space-y-10">
                <section className="space-y-4">
                  <h2 className="text-base font-semibold text-foreground">Who and why</h2>
                  <Field label="Discovery title" error={errors.meta?.title?.message}>
                    <input className={inputClass} {...register("meta.title")} />
                  </Field>
                  <Field label="Client or organization" error={errors.meta?.clientOrg?.message}>
                    <input className={inputClass} {...register("meta.clientOrg")} />
                  </Field>
                  <Field label="Call date (optional)" error={errors.meta?.date?.message}>
                    <input className={inputClass} type="date" {...register("meta.date")} />
                  </Field>
                  <Field label="Stakeholders (optional)" error={errors.meta?.stakeholders?.message}>
                    <textarea
                      rows={3}
                      className={inputClass}
                      placeholder="Names and roles on the call"
                      {...register("meta.stakeholders")}
                    />
                  </Field>
                  <Field
                    label="What pain are we solving, and what does good look like?"
                    error={errors.meta?.painAndOutcome?.message}
                  >
                    <textarea
                      rows={5}
                      className={inputClass}
                      {...register("meta.painAndOutcome")}
                    />
                  </Field>
                  <Field label="Facilitator notes (optional)" error={errors.meta?.facilitatorNotes?.message}>
                    <textarea rows={3} className={inputClass} {...register("meta.facilitatorNotes")} />
                  </Field>
                </section>

                <section className="space-y-4 border-t border-border pt-8">
                  <h2 className="text-base font-semibold text-foreground">Systems</h2>
                  <p className="text-sm text-muted">
                    List every tool involved. Match names to what you will use in flows (for example,
                    &quot;Wrike&quot;).
                  </p>
                  {systemFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="space-y-3 rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">System {index + 1}</span>
                        {systemFields.length > 1 ? (
                          <button
                            type="button"
                            className="text-xs text-accent"
                            onClick={() => removeSystem(index)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <Field
                        label="Name"
                        error={errors.systems?.[index]?.name?.message}
                      >
                        <input className={inputClass} {...register(`systems.${index}.name`)} />
                      </Field>
                      <Field label="Role" error={errors.systems?.[index]?.role?.message}>
                        <select className={inputClass} {...register(`systems.${index}.role`)}>
                          <option value="hub">Hub / system of record</option>
                          <option value="source">Source</option>
                          <option value="destination">Destination</option>
                          <option value="bidirectional">Bidirectional peer</option>
                        </select>
                      </Field>
                      <Field label="Owner / SME (optional)">
                        <input className={inputClass} {...register(`systems.${index}.owner`)} />
                      </Field>
                      <Field label="Deployment" error={errors.systems?.[index]?.deployment?.message}>
                        <select className={inputClass} {...register(`systems.${index}.deployment`)}>
                          <option value="saas">Cloud (SaaS)</option>
                          <option value="onprem">On-prem or private cloud</option>
                          <option value="unknown">Not sure yet</option>
                        </select>
                      </Field>
                      <Field label="Admin access for integration setup">
                        <select className={inputClass} {...register(`systems.${index}.adminAccess`)}>
                          <option value="unknown">Not sure</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </Field>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="rounded-full border border-dashed border-accent px-4 py-2 text-sm font-medium text-accent"
                    onClick={() =>
                      appendSystem({
                        name: "",
                        role: "destination",
                        owner: "",
                        deployment: "saas",
                        adminAccess: "unknown",
                      })
                    }
                  >
                    Add another system
                  </button>
                  {errors.systems?.message ? (
                    <p className="text-sm text-accent">{String(errors.systems.message)}</p>
                  ) : null}
                </section>

                <section className="space-y-4 border-t border-border pt-8">
                  <h2 className="text-base font-semibold text-foreground">Wrike specifics</h2>
                  <p className="text-sm text-muted">
                    Wrike-specific detail helps everyone speak the same language about spaces, types,
                    and fields.
                  </p>
                  <Field label="Spaces or folders in scope">
                    <textarea rows={3} className={inputClass} {...register("wrike.spacesFolders")} />
                  </Field>
                  <Field label="Item types (tasks, projects, custom types…)">
                    <textarea rows={3} className={inputClass} {...register("wrike.itemTypes")} />
                  </Field>
                  <Field label="Important custom fields">
                    <textarea rows={3} className={inputClass} {...register("wrike.customFields")} />
                  </Field>
                  <Field label="Permissions or visibility sensitivities">
                    <textarea rows={3} className={inputClass} {...register("wrike.permissions")} />
                  </Field>
                </section>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-10">
                <section className="space-y-4">
                  <h2 className="text-base font-semibold text-foreground">Workato / Unito pattern</h2>
                  <Field label="Where will this orchestration live?" error={errors.pattern?.tool?.message}>
                    <select className={inputClass} {...register("pattern.tool")}>
                      <option value="unknown">Not sure yet</option>
                      <option value="workato">Workato</option>
                      <option value="unito">Unito</option>
                      <option value="both">Workato and Unito</option>
                    </select>
                  </Field>
                  <Field label="Existing recipes, connectors, or Unito flows (optional)">
                    <textarea
                      rows={4}
                      className={inputClass}
                      placeholder="Links, recipe names, or notes"
                      {...register("pattern.existingRefs")}
                    />
                  </Field>
                </section>

                <section className="space-y-4 border-t border-border pt-8">
                  <h2 className="text-base font-semibold text-foreground">Flows</h2>
                  <p className="text-sm text-muted">
                    One connection at a time. Use the same tool names you typed in Systems (for
                    example Wrike and Jira) so the map can draw the lines.
                  </p>
                  {flowFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="space-y-3 rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Connection {index + 1}</span>
                        {flowFields.length > 1 ? (
                          <button
                            type="button"
                            className="text-xs text-accent"
                            onClick={() => removeFlow(index)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field
                          label="Sends / updates from"
                          error={errors.flows?.[index]?.fromSystem?.message}
                        >
                          <input
                            className={inputClass}
                            placeholder="e.g. Wrike"
                            {...register(`flows.${index}.fromSystem`)}
                          />
                        </Field>
                        <Field label="Receives in" error={errors.flows?.[index]?.toSystem?.message}>
                          <input
                            className={inputClass}
                            placeholder="e.g. Jira"
                            {...register(`flows.${index}.toSystem`)}
                          />
                        </Field>
                      </div>
                      <Field
                        label="In your own words, what should stay in sync?"
                        error={errors.flows?.[index]?.objects?.message}
                      >
                        <textarea
                          rows={3}
                          className={inputClass}
                          placeholder="Example: tasks and status, or comments when someone updates a task"
                          {...register(`flows.${index}.objects`)}
                        />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="When should this run?" error={errors.flows?.[index]?.trigger?.message}>
                          <select className={inputClass} {...register(`flows.${index}.trigger`)}>
                            <option value="event">When something changes</option>
                            <option value="schedule">On a schedule</option>
                            <option value="manual">When someone clicks “run”</option>
                            <option value="other">Other</option>
                          </select>
                        </Field>
                        <Field label="One way or both ways?" error={errors.flows?.[index]?.direction?.message}>
                          <select className={inputClass} {...register(`flows.${index}.direction`)}>
                            <option value="one_way">One way</option>
                            <option value="bidirectional">Both ways</option>
                          </select>
                        </Field>
                      </div>
                      <Field label="If you picked Other, say what you mean">
                        <input
                          className={inputClass}
                          placeholder="Optional"
                          {...register(`flows.${index}.triggerDetail`)}
                        />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="How often (optional)">
                          <input
                            className={inputClass}
                            placeholder="e.g. every hour, daily"
                            {...register(`flows.${index}.frequency`)}
                          />
                        </Field>
                        <Field label="Rough volume (optional)">
                          <input
                            className={inputClass}
                            placeholder="e.g. hundreds of updates per day"
                            {...register(`flows.${index}.volumeEstimate`)}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="rounded-full border border-dashed border-accent px-4 py-2 text-sm font-medium text-accent"
                    onClick={() =>
                      appendFlow({
                        fromSystem: "",
                        toSystem: "",
                        objects: "",
                        trigger: "event",
                        triggerDetail: "",
                        direction: "one_way",
                        frequency: "",
                        volumeEstimate: "",
                      })
                    }
                  >
                    Add another flow
                  </button>
                </section>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-10">
                <section className="space-y-4">
                  <h2 className="text-base font-semibold text-foreground">Keeping data in sync</h2>
                  <p className="text-sm text-muted">
                    Skip anything you do not know yet — these are conversation starters, not a test.
                  </p>
                  <Field label="How do we know it is the same work item in both tools?">
                    <textarea
                      rows={3}
                      className={inputClass}
                      placeholder="Example: same email, same ID, or a link field"
                      {...register("dataRules.identity")}
                    />
                  </Field>
                  <Field label="If the same thing gets created twice, what should happen?">
                    <textarea
                      rows={3}
                      className={inputClass}
                      placeholder="Example: keep one, merge, or flag for review"
                      {...register("dataRules.deduping")}
                    />
                  </Field>
                  <Field label="When something is deleted in one tool, what should happen in the other?">
                    <textarea
                      rows={3}
                      className={inputClass}
                      placeholder="Example: delete, leave, or archive"
                      {...register("dataRules.deletes")}
                    />
                  </Field>
                  <Field label="Any fields that must stay private or masked?">
                    <textarea
                      rows={3}
                      className={inputClass}
                      placeholder="Example: salary, health notes, attachments"
                      {...register("dataRules.confidential")}
                    />
                  </Field>
                </section>

                <section className="space-y-4 border-t border-border pt-8">
                  <h2 className="text-base font-semibold text-foreground">Launch and follow-ups</h2>
                  <p className="text-sm text-muted">
                    Light touch — enough to know who owns what after the call.
                  </p>
                  <Field label="How will we know if something breaks?">
                    <textarea
                      rows={3}
                      className={inputClass}
                      placeholder="Example: email alert, ticket queue, dashboard"
                      {...register("operations.monitoring")}
                    />
                  </Field>
                  <Field label="Who fixes problems after this goes live?">
                    <textarea
                      rows={2}
                      className={inputClass}
                      placeholder="Name or team"
                      {...register("operations.supportOwner")}
                    />
                  </Field>
                  <Field label="If we need to turn this off, what is the plan?">
                    <textarea
                      rows={3}
                      className={inputClass}
                      placeholder="Example: pause sync, rollback, who approves"
                      {...register("operations.rollback")}
                    />
                  </Field>
                  <Field label="Rough timing: when would you like this live?">
                    <textarea
                      rows={2}
                      className={inputClass}
                      placeholder="Example: next quarter, after a pilot, no rush"
                      {...register("operations.goLive")}
                    />
                  </Field>
                  <Field label="Anything still unclear? Questions for next time">
                    <textarea
                      rows={4}
                      className={inputClass}
                      placeholder="List questions or follow-ups"
                      {...register("openQuestions")}
                    />
                  </Field>
                </section>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={step === DISCOVERY_STEP_TITLES.length - 1}
                className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
            </div>

            {narrow && previewTab === "form" ? (
              <div className="lg:hidden">
                <ImportExportBeigePanel
                  transcriptPaste={transcriptPaste}
                  onTranscriptPasteChange={(v) => {
                    setTranscriptPaste(v);
                    setImportError(null);
                  }}
                  importLoading={importLoading}
                  importError={importError}
                  pendingImport={pendingImport}
                  onTranscriptFileChange={onTranscriptFileChange}
                  runTranscriptImport={runTranscriptImport}
                  applyTranscriptImport={applyTranscriptImport}
                  clearPendingImport={() => setPendingImport(null)}
                  exportPdf={exportPdf}
                />
              </div>
            ) : null}
          </section>

          <aside
            className={`no-print flex-1 lg:sticky lg:top-6 lg:self-start ${
              narrow && previewTab !== "preview" ? "hidden" : ""
            }`}
          >
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Nucleus map</h2>
              <div className="h-[320px] sm:h-[420px]">
                <NucleusScene
                  graph={graph}
                  flows={live.flows}
                  reducedMotion={reducedMotion || narrow}
                />
              </div>
              <div className="rounded-xl border border-[#c4a574]/45 bg-[#e8d4bc] px-3 py-3 text-xs leading-relaxed text-[#4a3d32] shadow-sm">
                <p className="font-medium text-[#3d3429]">
                  The map updates as you add systems and flows.
                </p>
                {graph.overflowSystemCount > 0 ? (
                  <p className="mt-2 text-[#5c4e42]">
                    Showing {graph.nodes.length - 1} systems in the scene; +
                    {graph.overflowSystemCount} more are named in your lists but hidden for clarity.
                  </p>
                ) : null}
              </div>
              <ImportExportBeigePanel
                transcriptPaste={transcriptPaste}
                onTranscriptPasteChange={(v) => {
                  setTranscriptPaste(v);
                  setImportError(null);
                }}
                importLoading={importLoading}
                importError={importError}
                pendingImport={pendingImport}
                onTranscriptFileChange={onTranscriptFileChange}
                runTranscriptImport={runTranscriptImport}
                applyTranscriptImport={applyTranscriptImport}
                clearPendingImport={() => setPendingImport(null)}
                exportPdf={exportPdf}
              />
            </div>
          </aside>
        </form>
      </div>

    </div>
  );
}

const inputClassBeige =
  "w-full rounded-lg border border-[#c4a574]/55 bg-[#f8f0e6] px-3 py-2 text-sm text-[#3d3429] placeholder:text-[#6b5e52] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

function ImportExportBeigePanel({
  transcriptPaste,
  onTranscriptPasteChange,
  importLoading,
  importError,
  pendingImport,
  onTranscriptFileChange,
  runTranscriptImport,
  applyTranscriptImport,
  clearPendingImport,
  exportPdf,
}: {
  transcriptPaste: string;
  onTranscriptPasteChange: (value: string) => void;
  importLoading: boolean;
  importError: string | null;
  pendingImport: DiscoveryPayload | null;
  onTranscriptFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  runTranscriptImport: () => Promise<void>;
  applyTranscriptImport: () => void;
  clearPendingImport: () => void;
  exportPdf: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#b89660]/55 bg-[#e8d4bc] p-4 text-[#3d3429] shadow-sm">
      <details className="group rounded-lg border border-[#c4a574]/50 bg-[#f0e0cc]/90 p-3 open:bg-[#f5e8d8]">
        <summary className="cursor-pointer list-none text-sm font-semibold text-[#3d3429] marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            Import from call transcript
            <span className="text-xs font-normal text-[#5c4e42]">
              (paste or upload .txt / .vtt)
            </span>
          </span>
        </summary>
        <p className="mt-3 text-xs leading-relaxed text-[#5c4e42]">
          Text is sent to this app&apos;s server and then to OpenAI to map into the form. Do
          not paste highly sensitive content unless your environment allows it.
        </p>
        <div className="mt-3 space-y-3">
          <textarea
            value={transcriptPaste}
            onChange={(e) => {
              onTranscriptPasteChange(e.target.value);
            }}
            rows={5}
            className={inputClassBeige}
            placeholder="Paste a Zoom transcript or meeting notes here…"
            disabled={importLoading}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-full border border-[#c4a574]/60 bg-[#f8f0e6] px-4 py-2 text-xs font-medium text-[#3d3429] hover:bg-[#fffaf5]">
              Upload file
              <input
                type="file"
                accept=".txt,.vtt,text/plain"
                className="sr-only"
                onChange={onTranscriptFileChange}
                disabled={importLoading}
              />
            </label>
            <button
              type="button"
              disabled={importLoading}
              onClick={() => void runTranscriptImport()}
              className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {importLoading ? "Extracting…" : "Extract with AI"}
            </button>
          </div>
          {importError ? (
            <p className="text-sm text-accent">{importError}</p>
          ) : null}
          {pendingImport ? (
            <div className="rounded-xl border border-accent/35 bg-accent-soft/60 p-4">
              <p className="text-sm font-medium text-foreground">
                Preview — check details, then apply
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                <li>
                  <span className="font-medium text-foreground">Title:</span>{" "}
                  {pendingImport.meta.title}
                </li>
                <li>
                  <span className="font-medium text-foreground">Client:</span>{" "}
                  {pendingImport.meta.clientOrg}
                </li>
                <li>
                  <span className="font-medium text-foreground">Systems:</span>{" "}
                  {pendingImport.systems.length}
                </li>
                <li>
                  <span className="font-medium text-foreground">Flows:</span>{" "}
                  {pendingImport.flows.length}
                </li>
                <li>
                  <span className="font-medium text-foreground">Pattern:</span>{" "}
                  {pendingImport.pattern.tool}
                </li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyTranscriptImport}
                  className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white"
                >
                  Apply to form
                </button>
                <button
                  type="button"
                  onClick={clearPendingImport}
                  className="rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </details>

      <div className="mt-4 border-t border-[#b89660]/55 pt-4">
        <p className="text-sm font-medium text-[#3d3429]">Export</p>
        <div className="mt-3">
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-full bg-[#f8f0e6] px-4 py-2 text-xs font-medium text-[#3d3429] shadow-sm ring-1 ring-[#c4a574]/60 hover:bg-[#fffaf5]"
          >
            Export PDF
          </button>
        </div>
        <p className="mt-2 text-xs text-[#5c4e42]">
          Downloads a summary PDF of your discovery answers.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs text-accent">{error}</span> : null}
    </label>
  );
}
