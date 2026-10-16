import { badRequest, database, normalizePhone, sameOrigin, serverError } from "../../../../../lib/server";
import { sendVerificationSms, solapiConfigured, verificationCodeHash } from "../../../../../lib/solapi";

type Verification = {
  last_sent_at: number;
  send_count: number;
  window_start: number;
};

type GlobalLimit = { sent_count: number; window_start: number };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const body = await request.json() as { phone?: string; purpose?: "signup" | "passwordReset" };
    const phone = normalizePhone(body.phone);
    const purpose = body.purpose === "passwordReset" ? "passwordReset" : "signup";
    if (!phone) return badRequest("올바른 휴대전화 번호를 입력해 주세요.");
    if (!solapiConfigured()) return badRequest("문자 인증 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.", 503);

    const db = database();
    const user = await db.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).first();
    if (purpose === "signup" && user) return badRequest("이미 가입된 전화번호입니다.", 409);
    if (purpose === "passwordReset" && !user) return badRequest("가입된 계정을 찾지 못했습니다.", 404);

    const now = Math.floor(Date.now() / 1000);
    const existing = await db.prepare(
      "SELECT last_sent_at, send_count, window_start FROM phone_verifications WHERE phone = ?",
    ).bind(phone).first<Verification>();
    if (existing && now - existing.last_sent_at < 60) {
      return badRequest(`${60 - (now - existing.last_sent_at)}초 후에 다시 요청해 주세요.`, 429);
    }
    const phoneCount = existing && now - existing.window_start < 3600 ? existing.send_count : 0;
    if (phoneCount >= 5) return badRequest("인증번호 요청이 많습니다. 1시간 후 다시 시도해 주세요.", 429);

    const globalLimit = await db.prepare(
      "SELECT sent_count, window_start FROM sms_rate_limits WHERE scope_key = 'global'",
    ).first<GlobalLimit>();
    const globalCount = globalLimit && now - globalLimit.window_start < 3600 ? globalLimit.sent_count : 0;
    if (globalCount >= 60) return badRequest("현재 문자 요청이 많습니다. 잠시 후 다시 시도해 주세요.", 429);

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const codeHash = await verificationCodeHash(phone, code);
    await sendVerificationSms(phone, code);

    const phoneWindowStart = phoneCount ? existing!.window_start : now;
    const globalWindowStart = globalCount ? globalLimit!.window_start : now;
    await db.batch([
      db.prepare(`INSERT INTO phone_verifications
        (phone, code_hash, expires_at, attempts, last_sent_at, send_count, window_start)
        VALUES (?, ?, ?, 0, ?, ?, ?)
        ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at,
          attempts = 0, last_sent_at = excluded.last_sent_at, send_count = excluded.send_count,
          window_start = excluded.window_start`)
        .bind(phone, codeHash, now + 300, now, phoneCount + 1, phoneWindowStart),
      db.prepare(`INSERT INTO sms_rate_limits (scope_key, sent_count, window_start) VALUES ('global', ?, ?)
        ON CONFLICT(scope_key) DO UPDATE SET sent_count = excluded.sent_count, window_start = excluded.window_start`)
        .bind(globalCount + 1, globalWindowStart),
    ]);
    return Response.json({ sent: true, expiresIn: 300, retryAfter: 60 });
  } catch (error) {
    return serverError(error);
  }
}
