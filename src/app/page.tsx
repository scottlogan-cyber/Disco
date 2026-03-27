import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card/80 px-6 py-5 backdrop-blur">
        <p className="text-sm font-medium text-accent">Integration Discovery</p>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Turn integration conversations into a clear, shared picture.
          </h1>
          <p className="text-lg leading-relaxed text-muted">
            Walk through focused questions about Wrike, Workato, and Unito —
            then see a friendly nucleus map of systems and flows your whole team
            can revisit and edit.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/discovery"
            className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-8 text-base font-medium text-white shadow-sm transition hover:opacity-95"
          >
            Start a discovery
          </Link>
          <p className="text-sm text-muted">
            No account required. Save a share link or a team link when you are
            ready.
          </p>
        </div>
      </main>
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted">
        Built for discovery calls — keep it kind, specific, and actionable.
      </footer>
    </div>
  );
}
