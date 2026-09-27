import { notFound } from "next/navigation";
import { Game } from "@/components/Game";

export default async function LobbyPage({ params }: { params: Promise<{ lobbyId: string }> }) {
  const { lobbyId } = await params;
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(lobbyId)) notFound();
  return <Game lobbyId={lobbyId} />;
}
