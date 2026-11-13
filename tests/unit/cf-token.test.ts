import { describe, expect, it } from "vitest";
import { cfTokenActive } from "../../worker/cfToken";

/** Nachgebaute Cloudflare-Antworten: welcher Weg den Token kennt */
function fakeCf(known: "account" | "user" | "none", status = "active") {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(url);
    const ok = (known === "account" && url.includes("/accounts/")) || (known === "user" && url.includes("/user/"));
    return new Response(JSON.stringify(ok ? { success: true, result: { status } } : { success: false, errors: [{ message: "Invalid API Token" }] }), { status: ok ? 200 : 401 });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe("DEPLOY_TOKEN prüfen", () => {
  it("Account-Token: gilt über /accounts/{id}/tokens/verify", async () => {
    const { fetcher, calls } = fakeCf("account");
    expect(await cfTokenActive("cfat_x", "acc1", fetcher)).toBe(true);
    expect(calls).toEqual(["https://api.cloudflare.com/client/v4/accounts/acc1/tokens/verify"]);
  });
  it("User-Token: Account-Weg lehnt ab, User-Weg gilt", async () => {
    const { fetcher, calls } = fakeCf("user");
    expect(await cfTokenActive("old", "acc1", fetcher)).toBe(true);
    expect(calls.map((c) => c.split("/v4/")[1])).toEqual(["accounts/acc1/tokens/verify", "user/tokens/verify"]);
  });
  it("Unbekannt, abgelaufen oder ohne Konto-ID: nicht gültig bzw. nur User-Weg", async () => {
    expect(await cfTokenActive("x", "acc1", fakeCf("none").fetcher)).toBe(false);
    expect(await cfTokenActive("x", "acc1", fakeCf("account", "expired").fetcher)).toBe(false);
    const { fetcher, calls } = fakeCf("user");
    expect(await cfTokenActive("x", undefined, fetcher)).toBe(true);
    expect(calls).toHaveLength(1);
  });
});
