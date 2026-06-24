import { Suspense } from "react";
import RoomQueryClient from "./room-query-client";

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-24 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RoomQueryClient />
    </Suspense>
  );
}
