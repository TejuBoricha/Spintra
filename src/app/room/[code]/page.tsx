import RoomClient from "./room-client";

export const dynamicParams = false;

export function generateStaticParams() {
  return [
    { code: "DEMO01" },
    { code: "X7F82K" },
    { code: "A3BC12" },
    { code: "M9ZK44" },
    { code: "P2XY77" },
    { code: "R8LM33" },
    { code: "T5VN90" },
  ];
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return <RoomClient code={code} />;
}
