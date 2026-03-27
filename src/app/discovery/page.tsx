import { Suspense } from "react";
import Link from "next/link";
import DiscoveryWizard from "@/components/discovery/DiscoveryWizard";

export default function DiscoveryPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="no-print border-b border-border bg-card/90 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            ← Home
          </Link>
          <p className="text-xs text-muted">Wrike · Workato · Unito</p>
        </div>
      </header>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center px-6 py-24 text-muted">
            Loading…
          </div>
        }
      >
        <DiscoveryWizard />
      </Suspense>
    </div>
  );
}
