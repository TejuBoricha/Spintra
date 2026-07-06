import { Skeleton } from "@/components/ui/skeleton";

export default function RoomLoading() {
  return (
    <div className="min-h-screen pt-16 flex flex-col md:flex-row w-full">
      <div className="flex-1 flex flex-col min-w-0 gap-4 p-4">
        <Skeleton className="h-12 w-full max-w-md" />
        <Skeleton className="h-8 w-48" />
        <div className="flex-1 grid grid-cols-1 gap-4 mt-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
      <div className="hidden md:flex md:w-80 md:border-l md:border-white/5 md:flex-col md:bg-background/50 md:backdrop-blur-sm p-4 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="flex-1 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
