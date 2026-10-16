import { badRequest, createPassword, database, newSession, normalizePhone, sameOrigin, serverError, validPassword } from "../../../../lib/server";
import { userWithConsents } from "../../../../lib/consents";
import { ACCOUNT_CONSENT_VERSION } from "../../../../lib/privacy";
import { solapiConfigured, verifyPhoneVerificationToken } from "../../../../lib/solapi";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const body = await request.json() as {
      phone?: string;
      password?: string;
      verificationToken?: string;
      accountConsentVersion?: string;
      accountAgreed?: boolean;
      ageConfirmed?: boolean;
    };
    const phone = normalizePhone(body.phone);
    if (!phone) return badRequest("올바른 휴대전화 번호를 입력해 주세요.");
    if (!validPassword(body.password)) return badRequest("비밀번호는 10~128자로 입력해 주세요.");
    if (body.accountAgreed !== true || body.accountConsentVersion !== ACCOUNT_CONSENT_VERSION) return badRequest("개인정보 수집·이용 내용을 확인하고 동의해 주세요.");
    if (body.ageConfirmed !== true) return badRequest("만 14세 이상 여부를 확인해 주세요.");
    const db = database();
    const found = await db.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).first();
    if (found) return badRequest("이미 가입된 전화번호입니다.", 409);
    if (!solapiConfigured()) return badRequest("문자 인증 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.", 503);
    if (!(await verifyPhoneVerificationToken(phone, body.verificationToken))) return badRequest("휴대전화 인증이 만료되었습니다. 다시 인증해 주세요.");
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    const { hash, salt } = await createPassword(body.password);
    await db.batch([
      db.prepare(`INSERT INTO users
        (id, phone, password_hash, password_salt, age, gender, military_status,
          preferred_region_1, preferred_region_2, preferred_region_3, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, phone, hash, salt, null, null, null, null, null, null, now),
      db.prepare("INSERT INTO user_consents (user_id, kind, version, accepted_at) VALUES (?, 'account', ?, ?)")
        .bind(id, ACCOUNT_CONSENT_VERSION, now),
      db.prepare("DELETE FROM phone_verifications WHERE phone = ?").bind(phone),
    ]);
    return await newSession(Response.json({ user: await userWithConsents({
      id,
      phone,
      age: null,
      gender: null,
      militaryStatus: null,
      preferredRegions: [],
    }) }, { status: 201 }), id, request);
  } catch (error) {
    return serverError(error);
  }
}
