import { badRequest, database, normalizePhone, sameOrigin, serverError } from "../../../../../lib/server";
import { createPhoneVerificationToken, safeEqualHex, solapiConfigured, verificationCodeHash } from "../../../../../lib/solapi";

type Verification = { code_hash: string; expires_at: number; attempts: number };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const body = await request.json() as { phone?: string; verificationCode?: string; purpose?: "signup" | "passwordReset" };
    const phone = normalizePhone(body.phone);
    const purpose = body.purpose === "passwordReset" ? "passwordReset" : "signup";
    if (!phone) return badRequest("올바른 휴대전화 번호를 입력해 주세요.");
    if (!solapiConfigured()) return badRequest("문자 인증 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.", 503);
    if (typeof body.verificationCode !== "string" || !/^\d{6}$/.test(body.verificationCode)) {
      return badRequest("문자로 받은 6자리 인증번호를 입력해 주세요.");
    }

    const db = database();
    const found = await db.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).first();
    if (purpose === "signup" && found) return badRequest("이미 가입된 전화번호입니다. 로그인해 주세요.", 409);
    if (purpose === "passwordReset" && !found) return badRequest("가입된 계정을 찾지 못했습니다.", 404);
    const verification = await db.prepare(
      "SELECT code_hash, expires_at, attempts FROM phone_verifications WHERE phone = ?",
    ).bind(phone).first<Verification>();
    const now = Math.floor(Date.now() / 1000);
    if (!verification) return badRequest("먼저 인증번호를 받아 주세요.");
    if (verification.expires_at < now) return badRequest("인증번호가 만료되었습니다. 새 인증번호를 받아 주세요.");
    if (verification.attempts >= 5) return badRequest("인증번호 입력 횟수를 초과했습니다. 새 인증번호를 받아 주세요.", 429);

    const actualHash = await verificationCodeHash(phone, body.verificationCode);
    if (!safeEqualHex(actualHash, verification.code_hash)) {
      await db.prepare("UPDATE phone_verifications SET attempts = attempts + 1 WHERE phone = ?").bind(phone).run();
      return badRequest("인증번호가 올바르지 않습니다.");
    }
    return Response.json({ verified: true, verificationToken: await createPhoneVerificationToken(phone) });
  } catch (error) {
    return serverError(error);
  }
}
