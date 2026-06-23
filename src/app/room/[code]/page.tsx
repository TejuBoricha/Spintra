import RoomClient from "./room-client";

export function generateStaticParams() {
  return [{ code: "DEMO01" }];
}

export default function RoomPage() {
  return <RoomClient />;
}
