import { redirect } from "next/navigation";

export default function RoomPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const roomCode = searchParams.code?.trim();

  if (roomCode) {
    redirect(`/room/${encodeURIComponent(roomCode.toUpperCase())}`);
  }

  redirect("/explore");
}
