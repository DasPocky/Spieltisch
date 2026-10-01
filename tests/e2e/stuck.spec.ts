import { expect, test } from "@playwright/test";
import { createRoom, joinRoom, newPhone, shot } from "./util";

test("Host geht offline – ein Mitspieler übernimmt", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "tutto", "Anna", "1111");
  await joinRoom(guest, code, "Ben", "1111");
  await host.context().close();
  await expect(guest.getByText("(Host) ist offline.")).toBeVisible();
  await shot(guest, "80-host-offline");
  await guest.getByRole("button", { name: "Host übernehmen" }).click();
  await expect(guest.getByRole("button", { name: "Spiel starten" })).toBeVisible();
  await expect(guest.getByText("Ben (du) · Host")).toBeVisible();
});

test("Spieler am Zug geht offline – der Host überspringt", async ({ browser }) => {
  const host = await newPhone(browser);
  const guest = await newPhone(browser);
  const code = await createRoom(host, "fischen", "Anna", "2222");
  await joinRoom(guest, code, "Ben", "2222");
  // Ben zuerst: nach oben schieben
  await host.getByRole("button", { name: "Ben nach oben" }).click();
  await host.getByRole("button", { name: "Spiel starten" }).click();
  await expect(guest.getByRole("button", { name: /hast du|antippen|wählen/ })).toBeVisible();
  await guest.context().close();
  await expect(host.getByText("Ben ist offline.")).toBeVisible();
  await shot(host, "81-player-offline");
  await host.getByRole("button", { name: "Überspringen" }).click();
  await expect(host.getByRole("button", { name: /hast du|antippen|wählen/ })).toBeVisible();
});
