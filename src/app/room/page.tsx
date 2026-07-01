import { redirect } from "next/navigation";

export default async function RoomPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const roomCode = params.code?.trim();

  // proxy.ts already redirects /room?code=X before this renders; this is a
  // defense-in-depth fallback in case proxy is ever bypassed (e.g. matcher change).
  if (roomCode) {
    redirect(`/room/${encodeURIComponent(roomCode.toUpperCase())}`);
  }

  redirect("/explore");
}
