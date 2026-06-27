function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/70 ${className}`} />;
}

export default function CampaignLoading() {
  return (
    <div className="-mx-8 -my-8" aria-label="Loading campaign">
      <div className="space-y-6 px-8 py-8">
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-3">
              <SkeletonBlock className="h-7 w-52" />
              <SkeletonBlock className="h-4 w-32" />
            </div>
            <SkeletonBlock className="h-9 w-28" />
          </div>
          <SkeletonBlock className="mt-5 h-20 w-full" />
        </div>

        <section className="rounded-xl border border-border bg-card/50 p-4">
          <SkeletonBlock className="h-4 w-36" />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-20 w-full" />
            ))}
          </div>
        </section>

        <SkeletonBlock className="h-72 w-full border border-border" />
        <SkeletonBlock className="h-64 w-full border border-border" />
      </div>
    </div>
  );
}
