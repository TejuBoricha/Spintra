import RoomClient from "./room-client";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> | { code: string } }) {
  const p = await params;
  return <RoomClient code={p.code} />;
}
