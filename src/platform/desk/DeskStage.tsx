import { useMemo } from "react";
import type { RoomState } from "@shared/platform/room";
import { TableStage } from "@/pages/Table";
import { tableModel } from "@/platform/table/model";

/** Der Tisch über der eigenen Hand – eigener Platz vorn, die anderen ringsum (nur bei Bedarf geladen, wegen 3D) */
export default function DeskStage({ room, online, me }: { room: RoomState; online: Set<string>; me: string }) {
  const model = useMemo(() => tableModel(room), [room]);
  return (
    <div className="table-room relative min-h-0 flex-1 overflow-hidden rounded-3xl" data-testid="desk-stage">
      <TableStage room={room} online={online} model={model} me={me} />
    </div>
  );
}
