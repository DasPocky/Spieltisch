import { expect, test } from "@playwright/test";
import { ALL_ON, newPhone, setConfig } from "./util";
test("probe", async ({ browser, request }) => {
  test.setTimeout(200_000);
  await setConfig(request, { ...ALL_ON, modes: { zehnphasen: { table: "on" }, glueckssieben: { table: "on" } } });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE" });
  const screen = await ctx.newPage();
  await screen.addInitScript(() => {
    const w = window as any; w.__gbr = 0; w.__raf = 0; w.__lt = 0;
    const g = Element.prototype.getBoundingClientRect; Element.prototype.getBoundingClientRect = function () { w.__gbr++; return g.call(this); };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__lt += e.duration; }).observe({ type: "longtask", buffered: true });
  });
  const cdp = await ctx.newCDPSession(screen);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.RATE ?? 4) });
  await screen.goto("/tisch");
  await screen.getByTestId("table-new").click();
  await expect(screen).toHaveURL(/\/tisch\/[A-Z0-9]{5}$/);
  const code = screen.url().split("/").pop()!;
  const pin = (await screen.evaluate((c) => localStorage.getItem(`spieltisch:table:${c}`), code))!;
  const phones = [];
  for (const n of ["Anna", "Ben", "Cem"]) { const p = await newPhone(browser); await p.goto(`/r/${code}#pin=${pin}`); await p.getByLabel("Dein Name").fill(n); await p.getByRole("button", { name: "Beitreten" }).click(); phones.push(p); }
  await expect(screen.getByTestId("table-seat")).toHaveCount(3);
  await phones[0].getByTestId("meet-play").click();
  await phones[0].getByTestId("pick-zehnphasen").click();
  await phones[0].getByRole("button", { name: "Spiel starten" }).click();
  const t0 = Date.now();
  await expect(screen.getByTestId("table-seat").first()).toContainText("Phase 1", { timeout: 60_000 });
  console.log("P start", Date.now() - t0);
  for (let i = 0; i < 4; i++) {
    const a = await screen.evaluate(() => { const w = window as any; const r = { gbr: w.__gbr, lt: Math.round(w.__lt) }; w.__gbr = 0; w.__lt = 0; return r; });
    console.log("P", i, JSON.stringify(a), "bubble", await screen.getByTestId("table-host-line").count());
    await screen.waitForTimeout(3000);
  }
  await setConfig(request, ALL_ON);
});
