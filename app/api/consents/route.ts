import { badRequest, currentUser, database, sameOrigin, serverError } from "../../../lib/server";
import { consentState } from "../../../lib/consents";
import { ACCOUNT_CONSENT_VERSION, SENSITIVE_CONSENT_VERSION } from "../../../lib/privacy";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const user = await currentUser(request);
    if (!user) return badRequest("로그인이 필요합니다.", 401);
    const body = await request.json() as { kind?: string; version?: string; agreed?: boolean; over14?: boolean };
    if (body.agreed !== true) return badRequest("동의 여부를 확인해 주세요.");
    const version = body.kind === "account" ? ACCOUNT_CONSENT_VERSION : body.kind === "sensitive" ? SENSITIVE_CONSENT_VERSION : null;
    if (!version || body.version !== version) return badRequest("동의 내용이 변경되었습니다. 새로고침 후 다시 확인해 주세요.");
    if (body.kind === "account" && body.over14 !== true) return badRequest("만 14세 이상만 이용할 수 있습니다.");
    if (body.kind === "sensitive" && !(await consentState(user.id)).hasAccountConsent) return badRequest("회원 개인정보 동의를 먼저 확인해 주세요.", 403);
    await database().prepare("INSERT INTO user_consents (user_id, kind, version, accepted_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING")
      .bind(user.id, body.kind, version, Math.floor(Date.now() / 1000)).run();
    return Response.json({ consents: await consentState(user.id) }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const user = await currentUser(request);
    if (!user) return badRequest("로그인이 필요합니다.", 401);
    const body = await request.json() as { kind?: string; confirm?: string };
    if (body.kind !== "sensitive" || body.confirm !== "DELETE_ASSESSMENT") return badRequest("검사 기록 삭제 확인이 필요합니다.");
    const db = database();
    await db.batch([
      db.prepare("DELETE FROM drafts WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM workspaces WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM user_consents WHERE user_id = ? AND kind = 'sensitive'").bind(user.id),
    ]);
    return Response.json({ consents: await consentState(user.id) }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return serverError(error);
  }
}
