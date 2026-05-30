const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export type ApiResponse<T = unknown> = { ok: true } & T | { ok: false; error: string };

export async function api<T = Record<string, unknown>>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<ApiResponse<T>> {
  // Fail loud at the boundary: an empty URL makes fetch() POST to the current page
  // (the static-asset host), which answers 405. That's never what we want.
  if (!API_URL) {
    throw new Error(
      "API URL is not configured. NEXT_PUBLIC_API_URL was missing at build time — " +
        "set it in next-app/.env.production (or .env.local for dev) and rebuild.",
    );
  }
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action, ...params }),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Network error ${res.status}`);
  return res.json();
}

export function weekStartOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
