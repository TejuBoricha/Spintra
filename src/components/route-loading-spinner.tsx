export function RouteLoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen bg-[#07050e] flex flex-col items-center justify-center gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
        <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 animate-spin" />
      </div>
      <p className="text-muted-foreground text-sm font-semibold tracking-wider animate-pulse uppercase">
        {label}
      </p>
    </div>
  );
}
