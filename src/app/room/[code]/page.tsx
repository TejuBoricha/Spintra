import { redirect } from "next/navigation";
import RoomClient from "./room-client";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> | { code: string } }) {
  const p = await params;
  // Room codes are uppercase (the generator's alphabet has no lowercase letters), so a code
  // typed or pasted in lowercase, or with a stray space, both easy on a phone, is sent to the
  // real address instead of looking up a room that cannot exist (audit R-9).
  let typed = p.code;
  try {
    typed = decodeURIComponent(p.code);
  } catch {
    // A malformed percent sequence: use the code as given.
  }
  const code = typed.trim().toUpperCase();
  if (code && code !== p.code) redirect(`/room/${encodeURIComponent(code)}`);
  return <RoomClient key={p.code} code={p.code} />;
}
