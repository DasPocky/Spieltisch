import { useContext, useMemo } from "react";
import type { RoomState } from "@shared/platform/room";
import { TableStage } from "@/pages/Table";
import { CallContext } from "@/platform/call/CallBar";
import { tableModel } from "@/platform/table/model";

/** Der Tisch über der eigenen Hand – eigener Platz vorn, die anderen ringsum (nur bei Bedarf geladen, wegen 3D) */
export default function DeskStage({ room, online, me }: { room: RoomState; online: Set<string>; me: string }) {
  const model = useMemo(() => tableModel(room), [room]);
  // Im Videochat: Mitspieler mit Kamera erscheinen mit Video an ihrem Platz
  const ctx = useContext(CallContext);
  const videos = useMemo(() => {
    if (!ctx || ctx.call.phase !== "on") return undefined;
    return Object.fromEntries(Object.entries(ctx.call.streams).filter(([id, s]) => ctx.call.peers[id]?.cam && s.getVideoTracks().length));
  }, [ctx]);
  return (
    <div className="table-room relative min-h-0 flex-1 overflow-hidden rounded-3xl" data-testid="desk-stage">
      <TableStage room={room} online={online} model={model} me={me} videos={videos} />
    </div>
  );
}
