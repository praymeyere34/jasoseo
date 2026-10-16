import { badRequest, database, newSession, normalizePhone, sameOrigin, serverError, verifyPassword } from "../../../../lib/server";
import { userWithConsents } from "../../../../lib/consents";

type StoredUser = {
  id: string;
  phone: string;
  password_hash: string;
  password_salt: string;
  age: number | null;
  gender: string | null;
  military_status: string | null;
  preferred_region_1: string | null;
  preferred_region_2: string | null;
  preferred_region_3: string | null;
};
type Attempts = { failed_count: number; window_start: number };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const body = await request.json() as { phone?: string; password?: string };
    const phone = normalizePhone(body.phone);
    if (!phone || typeof body.password !== "string") return badRequest("전화번호와 비밀번호를 확인해 주세요.");
    const db = database();
    const now = Math.floor(Date.now() / 1000);
    const attempts = await db.prepare("SELECT failed_count, window_start FROM login_attempts WHERE phone = ?").bind(phone).first<Attempts>();
    if (attempts && now - attempts.window_start < 900 && attempts.failed_count >= 5) {
      return badRequest("로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.", 429);
    }
    const user = await db.prepare(`SELECT id, phone, password_hash, password_salt, age, gender, military_status,
      preferred_region_1, preferred_region_2, preferred_region_3 FROM users WHERE phone = ?`)
      .bind(phone).first<StoredUser>();
    const valid = user && await verifyPassword(body.password, user.password_salt, user.password_hash);
    if (!valid || !user) {
      const count = attempts && now - attempts.window_start < 900 ? attempts.failed_count + 1 : 1;
      const start = attempts && now - attempts.window_start < 900 ? attempts.window_start : now;
      await db.prepare("INSERT INTO login_attempts (phone, failed_count, window_start) VALUES (?, ?, ?) ON CONFLICT(phone) DO UPDATE SET failed_count = excluded.failed_count, window_start = excluded.window_start")
        .bind(phone, count, start).run();
      return badRequest("전화번호 또는 비밀번호가 올바르지 않습니다.", 401);
    }
    await db.prepare("DELETE FROM login_attempts WHERE phone = ?").bind(phone).run();
    return await newSession(Response.json({ user: await userWithConsents({
      id: user.id,
      phone: user.phone,
      age: user.age,
      gender: user.gender,
      militaryStatus: user.military_status,
      preferredRegions: [user.preferred_region_1, user.preferred_region_2, user.preferred_region_3]
        .filter((value): value is string => Boolean(value)),
    }) }), user.id, request);
  } catch (error) {
    return serverError(error);
  }
}
