"use client";

import { useSearchParams } from "next/navigation";
import RoomClient from "./[code]/room-client";

export default function RoomQueryClient() {
  const searchParams = useSearchParams();
  const roomCode = searchParams.get("code")?.trim().toUpperCase() || "DEMO01";

  return <RoomClient code={roomCode} />;
}
