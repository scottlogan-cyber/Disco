"use client";

import type { DiscoveryPayload } from "@/lib/schema/discovery";

export function PrintSummary({ data }: { data: DiscoveryPayload }) {
  return (
    <div className="space-y-6 text-foreground">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold">{data.meta.title}</h1>
        <p className="text-sm text-muted">
          {data.meta.clientOrg}
          {data.meta.date ? ` · ${data.meta.date}` : ""}
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold">Who and why</h2>
        {data.meta.stakeholders ? (
          <p className="mt-1 text-sm whitespace-pre-wrap">{data.meta.stakeholders}</p>
        ) : null}
        <p className="mt-2 text-sm whitespace-pre-wrap">{data.meta.painAndOutcome}</p>
        {data.meta.facilitatorNotes ? (
          <p className="mt-3 text-sm text-muted whitespace-pre-wrap">
            <span className="font-medium text-foreground">Facilitator notes: </span>
            {data.meta.facilitatorNotes}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Systems</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
          {data.systems.map((s, i) => (
            <li key={i}>
              <span className="font-medium">{s.name}</span> ({s.role}) —{" "}
              {s.deployment}
              {s.owner ? ` · Owner: ${s.owner}` : ""}
              {s.adminAccess ? ` · Admin access: ${s.adminAccess}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Wrike specifics</h2>
        <dl className="mt-2 grid gap-2 text-sm">
          <div>
            <dt className="font-medium">Spaces / folders</dt>
            <dd className="whitespace-pre-wrap text-muted">{data.wrike.spacesFolders || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium">Item types</dt>
            <dd className="whitespace-pre-wrap text-muted">{data.wrike.itemTypes || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium">Custom fields</dt>
            <dd className="whitespace-pre-wrap text-muted">{data.wrike.customFields || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium">Permissions</dt>
            <dd className="whitespace-pre-wrap text-muted">{data.wrike.permissions || "—"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Pattern</h2>
        <p className="mt-1 text-sm">
          Tool: {data.pattern.tool}
          {data.pattern.existingRefs ? (
            <span className="block mt-2 whitespace-pre-wrap text-muted">
              {data.pattern.existingRefs}
            </span>
          ) : null}
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Flows</h2>
        <ol className="mt-2 list-decimal space-y-3 pl-5 text-sm">
          {data.flows.map((f, i) => (
            <li key={i} className="space-y-1">
              <p>
                <span className="font-medium">
                  {f.fromSystem} → {f.toSystem}
                </span>{" "}
                ({f.direction})
              </p>
              <p className="text-muted whitespace-pre-wrap">{f.objects}</p>
              <p className="text-xs text-muted">
                Trigger: {f.trigger}
                {f.triggerDetail ? ` — ${f.triggerDetail}` : ""}
                {f.frequency ? ` · Frequency: ${f.frequency}` : ""}
                {f.volumeEstimate ? ` · Volume: ${f.volumeEstimate}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Data rules</h2>
        <dl className="mt-2 grid gap-2 text-sm">
          {[
            ["Identity / matching", data.dataRules.identity],
            ["Deduping", data.dataRules.deduping],
            ["Deletes", data.dataRules.deletes],
            ["Confidential fields", data.dataRules.confidential],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className="font-medium">{k}</dt>
              <dd className="whitespace-pre-wrap text-muted">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Operations</h2>
        <dl className="mt-2 grid gap-2 text-sm">
          {[
            ["Monitoring", data.operations.monitoring],
            ["Support owner", data.operations.supportOwner],
            ["Rollback", data.operations.rollback],
            ["Go-live window", data.operations.goLive],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className="font-medium">{k}</dt>
              <dd className="whitespace-pre-wrap text-muted">{v || "—"}</dd>
            </div>
          ))}
        </dl>
        {data.openQuestions ? (
          <div className="mt-4">
            <h3 className="font-medium">Open questions</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{data.openQuestions}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
