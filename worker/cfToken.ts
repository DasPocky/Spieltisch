/**
 * Ist ein Cloudflare-API-Token gültig (aktiv, nicht abgelaufen, nicht gelöscht)?
 * Account-API-Tokens (cfat_…) prüft Cloudflare unter /accounts/{id}/tokens/verify, ältere User-Tokens unter
 * /user/tokens/verify – der jeweils andere Weg antwortet mit 401. Darum erst das eine, dann das andere.
 */
export async function cfTokenActive(token: string, accountId: string | undefined, fetcher: typeof fetch = fetch): Promise<boolean> {
  const verify = async (path: string) => {
    const res = await fetcher(`https://api.cloudflare.com/client/v4/${path}`, { headers: { authorization: `Bearer ${token}` } });
    const body = (await res.json().catch(() => null)) as { result?: { status?: string } } | null;
    return res.ok && body?.result?.status === "active";
  };
  return (!!accountId && await verify(`accounts/${accountId}/tokens/verify`)) || await verify("user/tokens/verify");
}
