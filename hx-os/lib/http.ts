export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const bad = (msg: string, status = 400) => Response.json({ error: msg }, { status });
export type Ctx<T> = { params: Promise<T> };
export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Run a route body; turn AuthError into a JSON error and audit every denial. */
export async function guarded(req: Request, fn: () => Promise<Response>): Promise<Response> {
  const { AuthError, getActor } = await import("./auth");
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.status === 401 || e.status === 403) {
        const { audit } = await import("./audit");
        await audit({ actor: getActor(req), action: "denied", detail: { method: req.method, path: new URL(req.url).pathname, reason: e.message } });
      }
      return bad(e.message, e.status);
    }
    throw e;
  }
}
