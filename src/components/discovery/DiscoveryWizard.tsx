"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NucleusScene from "@/components/visual/NucleusScene";
import { PrintSummary } from "@/components/discovery/PrintSummary";
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
  encodeDiscoveryToHash,
  readHashFromWindow,
} from "@/lib/share/stateCodec";
import { useMediaReducedMotion } from "@/lib/hooks/useMediaReducedMotion";
import { useIsNarrowScreen } from "@/lib/hooks/useIsNarrowScreen";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

export default function DiscoveryWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const remoteId = searchParams.get("id");

  const [step, setStep] = useState(0);
  const [shareError, setShareError] = useState<string | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(!!remoteId);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(remoteId);
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamMessage, setTeamMessage] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"form" | "preview">("form");

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
    formState: { errors },
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
        setTeamId(remoteId);
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

  async function copyShareLink() {
    const parsed = discoverySchema.safeParse(getValues());
    if (!parsed.success) {
      await trigger();
      return;
    }
    const hash = encodeDiscoveryToHash(parsed.data);
    const url = `${window.location.origin}/discovery#${hash}`;
    await navigator.clipboard.writeText(url);
    setTeamMessage("Share link copied to your clipboard.");
    setTimeout(() => setTeamMessage(null), 3500);
  }

  function exportJson() {
    const parsed = discoverySchema.safeParse(getValues());
    if (!parsed.success) {
      void trigger();
      return;
    }
    const blob = new Blob([JSON.stringify(parsed.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${parsed.data.meta.title || "discovery"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printSummary() {
    window.print();
  }

  async function saveTeamLink() {
    const parsed = discoverySchema.safeParse(getValues());
    if (!parsed.success) {
      await trigger();
      return;
    }
    setTeamBusy(true);
    setTeamMessage(null);
    try {
      if (teamId) {
        const res = await fetch(`/api/discoveries/${teamId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? "Could not save.");
        }
        setTeamMessage("Team discovery saved.");
      } else {
        const res = await fetch("/api/discoveries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(
            (j as { error?: string }).error ?? "Could not create team link."
          );
        }
        const { id } = (await res.json()) as { id: string };
        setTeamId(id);
        router.replace(`/discovery?id=${id}`);
        setTeamMessage("Team link created — bookmark this URL.");
      }
    } catch (e) {
      setTeamMessage((e as Error).message);
    } finally {
      setTeamBusy(false);
      setTimeout(() => setTeamMessage(null), 5000);
    }
  }

  const showShareActions = step >= 1;

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
        {teamMessage ? (
          <p className="mx-auto mt-3 max-w-6xl text-sm text-muted">{teamMessage}</p>
        ) : null}
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 lg:flex-row">
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

          <form
            className={`space-y-6 ${narrow && previewTab !== "form" ? "hidden" : ""}`}
            onSubmit={handleSubmit(() => {})}
          >
            {step === 0 && (
              <div className="space-y-4">
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
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
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
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
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
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
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
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Each flow is one directional story. Use the exact system names you used above so
                  the nucleus can connect them.
                </p>
                {flowFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="space-y-3 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Flow {index + 1}</span>
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
                        label="From system"
                        error={errors.flows?.[index]?.fromSystem?.message}
                      >
                        <input className={inputClass} {...register(`flows.${index}.fromSystem`)} />
                      </Field>
                      <Field label="To system" error={errors.flows?.[index]?.toSystem?.message}>
                        <input className={inputClass} {...register(`flows.${index}.toSystem`)} />
                      </Field>
                    </div>
                    <Field
                      label="What moves between them?"
                      error={errors.flows?.[index]?.objects?.message}
                    >
                      <textarea
                        rows={3}
                        className={inputClass}
                        placeholder="e.g. Tasks and status; comments on update"
                        {...register(`flows.${index}.objects`)}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Trigger" error={errors.flows?.[index]?.trigger?.message}>
                        <select className={inputClass} {...register(`flows.${index}.trigger`)}>
                          <option value="event">Event / real-time</option>
                          <option value="schedule">Scheduled</option>
                          <option value="manual">Manual / on-demand</option>
                          <option value="other">Other</option>
                        </select>
                      </Field>
                      <Field label="Direction" error={errors.flows?.[index]?.direction?.message}>
                        <select className={inputClass} {...register(`flows.${index}.direction`)}>
                          <option value="one_way">One way</option>
                          <option value="bidirectional">Bidirectional</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Trigger detail (if other)">
                      <input className={inputClass} {...register(`flows.${index}.triggerDetail`)} />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Frequency (optional)">
                        <input className={inputClass} {...register(`flows.${index}.frequency`)} />
                      </Field>
                      <Field label="Volume estimate (optional)">
                        <input className={inputClass} {...register(`flows.${index}.volumeEstimate`)} />
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
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <Field label="How do we match records across systems?">
                  <textarea rows={3} className={inputClass} {...register("dataRules.identity")} />
                </Field>
                <Field label="Deduping or merge rules">
                  <textarea rows={3} className={inputClass} {...register("dataRules.deduping")} />
                </Field>
                <Field label="Deletes, archiving, or lifecycle">
                  <textarea rows={3} className={inputClass} {...register("dataRules.deletes")} />
                </Field>
                <Field label="Confidential fields or redaction">
                  <textarea rows={3} className={inputClass} {...register("dataRules.confidential")} />
                </Field>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <Field label="Monitoring and alerts">
                  <textarea rows={3} className={inputClass} {...register("operations.monitoring")} />
                </Field>
                <Field label="Who owns support after go-live?">
                  <textarea rows={2} className={inputClass} {...register("operations.supportOwner")} />
                </Field>
                <Field label="Rollback or pause plan">
                  <textarea rows={3} className={inputClass} {...register("operations.rollback")} />
                </Field>
                <Field label="Target go-live window">
                  <textarea rows={2} className={inputClass} {...register("operations.goLive")} />
                </Field>
                <Field label="Open questions">
                  <textarea
                    rows={4}
                    className={inputClass}
                    placeholder="What still needs a follow-up?"
                    {...register("openQuestions")}
                  />
                </Field>
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

            {showShareActions ? (
              <div className="space-y-3 rounded-xl border border-border bg-accent-soft/40 p-4">
                <p className="text-sm font-medium text-foreground">Share and export</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyShareLink()}
                    className="rounded-full bg-card px-4 py-2 text-xs font-medium text-foreground shadow-sm ring-1 ring-border"
                  >
                    Copy share link
                  </button>
                  <button
                    type="button"
                    onClick={exportJson}
                    className="rounded-full bg-card px-4 py-2 text-xs font-medium text-foreground shadow-sm ring-1 ring-border"
                  >
                    Download JSON
                  </button>
                  <button
                    type="button"
                    onClick={printSummary}
                    className="rounded-full bg-card px-4 py-2 text-xs font-medium text-foreground shadow-sm ring-1 ring-border"
                  >
                    Print summary
                  </button>
                  <button
                    type="button"
                    disabled={teamBusy}
                    onClick={() => void saveTeamLink()}
                    className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {teamId ? "Save team discovery" : "Save to team link"}
                  </button>
                </div>
                <p className="text-xs text-muted">
                  Share links keep data in the URL (great for continuity). Team links need Redis
                  configured on Vercel — see README.
                </p>
              </div>
            ) : null}
          </form>
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
                reducedMotion={reducedMotion || narrow}
              />
            </div>
            {graph.overflowSystemCount > 0 ? (
              <p className="text-xs text-muted">
                Showing {graph.nodes.length - 1} systems in the scene; +
                {graph.overflowSystemCount} more are named in your lists but hidden for clarity.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <div className="hidden print-summary">
        <PrintSummary data={live} />
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
