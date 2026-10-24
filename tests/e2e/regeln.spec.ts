import { expect, test } from "@playwright/test";
import { closeSettings, createRoom, joinRoom, newPhone, openSettings, shot } from "./util";

test("Regelpakete: Standard, Kurz, Wild – einzelne Hausregel macht „Eigene“, Standard setzt zurück, Gäste sehen nur", async ({ page, browser }) => {
  const room = await createRoom(page, "eins", "Anna", "8181");
  await openSettings(page);
  const rules = page.getByRole("radiogroup", { name: "Regeln" });
  await expect(rules.getByRole("radio", { name: /Standard/ })).toHaveAttribute("aria-checked", "true");
  await expect(rules.getByRole("radio")).toHaveCount(3);
  await shot(page, "c3-regeln-standard");

  await rules.getByRole("radio", { name: /Wild/ }).click();
  await expect(rules.getByRole("radio", { name: /Wild/ })).toHaveAttribute("aria-checked", "true");
  // Die Hausregeln zeigen, was das Paket gesetzt hat
  await page.getByRole("button", { name: /^Hausregeln/ }).click();
  await expect(page.getByRole("checkbox", { name: /7-0/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Ziehkarten stapeln/ })).toBeChecked();

  // Eine Regel einzeln ändern: „Eigene“ mit Zahl der Änderungen
  await page.getByRole("checkbox", { name: /7-0/ }).click();
  await expect(rules.getByRole("radio", { name: /Eigene/ })).toHaveAttribute("aria-checked", "true");
  await expect(rules.getByRole("radio", { name: /Eigene/ })).toContainText("2 Änderungen");
  await shot(page, "c3-regeln-eigene");

  // Gast sieht dieselben Regeln, kann sie aber nicht ändern
  const ben = await newPhone(browser);
  await joinRoom(ben, room, "Ben", "8181");
  await openSettings(ben);
  const seen = ben.getByRole("radiogroup", { name: "Regeln" });
  await expect(seen.getByRole("radio", { name: /Eigene/ })).toHaveAttribute("aria-checked", "true");
  await expect(seen.getByRole("radio", { name: /Standard/ })).toBeDisabled();

  await rules.getByRole("radio", { name: /Standard/ }).click();
  await expect(rules.getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("checkbox", { name: /Ziehkarten stapeln/ })).not.toBeChecked();
  await expect(seen.getByRole("radio", { name: /Standard/ })).toHaveAttribute("aria-checked", "true");

  // Kurz: Zusammenfassung in der Lobby nennt das Paket
  await rules.getByRole("radio", { name: /Kurz/ }).click();
  await closeSettings(page);
  await expect(page.getByTestId("settings-summary")).toContainText("Regeln: Kurz");
  await shot(page, "c3-regeln-lobby");

  // Echte Karten: Hausregeln gelten nicht, also auch kein „Wild“
  await openSettings(page);
  await page.getByRole("radio", { name: /Echte Karten/ }).click();
  await expect(rules.getByRole("radio", { name: /Wild/ })).toHaveCount(0);
  await expect(rules.getByRole("radio", { name: /Kurz/ })).toBeVisible();
});

test("Werwolf: Rollen-Pakete Einsteiger und Komplex", async ({ page }) => {
  await createRoom(page, "werwolf", "Anna", "8282");
  await openSettings(page);
  const rules = page.getByRole("radiogroup", { name: "Regeln" });
  await expect(rules.getByRole("radio")).toHaveCount(3);
  await rules.getByRole("radio", { name: /Komplex/ }).click();
  await expect(rules.getByRole("radio", { name: /Komplex/ })).toHaveAttribute("aria-checked", "true");
  await shot(page, "c4-werwolf-pakete");
  await rules.getByRole("radio", { name: /Einsteiger/ }).click();
  await expect(rules.getByRole("radio", { name: /Einsteiger/ })).toHaveAttribute("aria-checked", "true");
  await closeSettings(page);
  await expect(page.getByTestId("settings-summary")).toContainText("Regeln: Einsteiger");
});
