import { env } from "cloudflare:workers";

const encoder = new TextEncoder();
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export function database(): D1Database {
  if (!env.DB) throw new Error("DB binding is unavailable");
  return env.DB;
}

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let digits = value.replace(/[^\d]/g, "");
  if (digits.startsWith("82") && digits.length === 12) digits = "0" + digits.slice(2);
  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 10 && value.length <= 128;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function badRequest(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function serverError(error: unknown): Response {
  console.error(error);
  return badRequest("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? []);
}

function randomHex(length: number): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(length)));
}

async function digest(value: string): Promise<string> {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function passwordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(salt).buffer as ArrayBuffer, iterations: 100_000 },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function createPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomHex(16);
  return { salt, hash: await passwordHash(password, salt) };
}

export async function verifyPassword(password: string, salt: string, expected: string): Promise<boolean> {
  const actual = hexToBytes(await passwordHash(password, salt));
  const target = hexToBytes(expected);
  if (actual.length !== target.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual[i] ^ target[i];
  return mismatch === 0;
}

export type CurrentUser = {
  id: string;
  phone: string;
  age: number | null;
  gender: string | null;
  militaryStatus: string | null;
  preferredRegions: string[];
};

export async function currentUser(request: Request): Promise<CurrentUser | null> {
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)jaseo_session=([a-f0-9]{64})(?:;|$)/);
  if (!cookie) return null;
  const tokenHash = await digest(cookie[1]);
  const row = await database().prepare(
    `SELECT users.id, users.phone, users.age, users.gender, users.military_status,
      users.preferred_region_1, users.preferred_region_2, users.preferred_region_3
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
  ).bind(tokenHash, Math.floor(Date.now() / 1000)).first<{
    id: string;
    phone: string;
    age: number | null;
    gender: string | null;
    military_status: string | null;
    preferred_region_1: string | null;
    preferred_region_2: string | null;
    preferred_region_3: string | null;
  }>();
  return row ? {
    id: row.id,
    phone: row.phone,
    age: row.age,
    gender: row.gender,
    militaryStatus: row.military_status,
    preferredRegions: [row.preferred_region_1, row.preferred_region_2, row.preferred_region_3]
      .filter((value): value is string => Boolean(value)),
  } : null;
}

export async function newSession(response: Response, userId: string, request: Request): Promise<Response> {
  const token = randomHex(32);
  const tokenHash = await digest(token);
  await database().prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(tokenHash, userId, Math.floor(Date.now() / 1000) + SESSION_SECONDS).run();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `jaseo_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`);
  return response;
}

export async function endSession(response: Response, request: Request): Promise<Response> {
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)jaseo_session=([a-f0-9]{64})(?:;|$)/);
  if (cookie) await database().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(cookie[1])).run();
  response.headers.append("Set-Cookie", "jaseo_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  return response;
}
