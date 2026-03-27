import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card/80 px-6 py-5 text-center backdrop-blur sm:text-left">
        <p className="text-sm font-medium text-accent">Integration Discovery</p>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-6 py-16 text-center">
        <div className="mx-auto max-w-xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Turn integration conversations into a clear, shared picture.
          </h1>
          <p className="text-lg leading-relaxed text-muted">
            Walk through focused questions about Wrike, Workato, and Unito —
            then see a friendly nucleus map of systems and flows your whole team
            can revisit and edit.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/discovery"
            className="inline-flex h-12 min-h-12 items-center justify-center whitespace-nowrap rounded-full bg-accent px-10 text-base font-medium text-white shadow-sm transition hover:opacity-95"
          >
            Start a discovery
          </Link>
          <p className="max-w-md text-sm text-muted">
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
