import { badRequest, createPassword, database, newSession, normalizePhone, sameOrigin, serverError, validPassword } from "../../../../../lib/server";
import { userWithConsents } from "../../../../../lib/consents";
import { solapiConfigured, verifyPhoneVerificationToken } from "../../../../../lib/solapi";

type StoredUser = {
  id: string;
  phone: string;
  age: number | null;
  gender: string | null;
  military_status: string | null;
  preferred_region_1: string | null;
  preferred_region_2: string | null;
  preferred_region_3: string | null;
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const body = await request.json() as { phone?: string; password?: string; verificationToken?: string };
    const phone = normalizePhone(body.phone);
    if (!phone) return badRequest("올바른 휴대전화 번호를 입력해 주세요.");
    if (!validPassword(body.password)) return badRequest("새 비밀번호는 10~128자로 입력해 주세요.");
    if (!solapiConfigured()) return badRequest("문자 인증 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.", 503);
    if (!(await verifyPhoneVerificationToken(phone, body.verificationToken))) {
      return badRequest("휴대전화 인증이 만료되었습니다. 다시 인증해 주세요.");
    }

    const db = database();
    const user = await db.prepare(`SELECT id, phone, age, gender, military_status,
      preferred_region_1, preferred_region_2, preferred_region_3 FROM users WHERE phone = ?`)
      .bind(phone).first<StoredUser>();
    if (!user) return badRequest("가입된 계정을 찾지 못했습니다.", 404);

    const { hash, salt } = await createPassword(body.password);
    await db.batch([
      db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").bind(hash, salt, user.id),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM login_attempts WHERE phone = ?").bind(phone),
      db.prepare("DELETE FROM phone_verifications WHERE phone = ?").bind(phone),
    ]);

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
