import { badRequest, currentUser, database, sameOrigin, serverError, verifyPassword } from "../../../lib/server";
import { userWithConsents } from "../../../lib/consents";

type Stored = { password_hash: string; password_salt: string };
const MILITARY_STATUSES = new Set(["completed", "not_completed"]);

function preferredRegion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const region = value.trim().replace(/\s+/g, " ");
  return region.length >= 2 && region.length <= 50 && region.endsWith("동") ? region : null;
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const user = await currentUser(request);
    if (!user) return badRequest("로그인이 필요합니다.", 401);
    const body = await request.json() as {
      section?: "basic" | "regions";
      age?: number;
      gender?: string;
      militaryStatus?: string;
      preferredRegions?: unknown[];
    };
    const db = database();

    if (body.section === "basic") {
      if (!Number.isInteger(body.age) || (body.age ?? 0) < 14 || (body.age ?? 0) > 100) return badRequest("나이는 만 14세부터 100세까지 입력해 주세요.");
      if (body.gender !== "male" && body.gender !== "female") return badRequest("성별을 선택해 주세요.");
      const militaryStatus = body.gender === "male" && MILITARY_STATUSES.has(body.militaryStatus ?? "") ? body.militaryStatus! : null;
      if (body.gender === "male" && !militaryStatus) return badRequest("군필 여부를 선택해 주세요.");
      await db.prepare("UPDATE users SET age = ?, gender = ?, military_status = ? WHERE id = ?")
        .bind(body.age!, body.gender, militaryStatus, user.id).run();
      return Response.json({ user: await userWithConsents({ ...user, age: body.age!, gender: body.gender, militaryStatus }) });
    }

    if (body.section === "regions") {
      const regions = Array.isArray(body.preferredRegions) ? body.preferredRegions.map(preferredRegion) : [];
      if (regions.length !== 3 || regions.some((region) => !region) || new Set(regions).size !== 3) return badRequest("서로 다른 취업 희망 지역 3곳을 동 단위까지 입력해 주세요.");
      await db.prepare("UPDATE users SET preferred_region_1 = ?, preferred_region_2 = ?, preferred_region_3 = ? WHERE id = ?")
        .bind(regions[0], regions[1], regions[2], user.id).run();
      return Response.json({ user: await userWithConsents({ ...user, preferredRegions: regions as string[] }) });
    }

    return badRequest("저장할 회원 정보를 확인해 주세요.");
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const user = await currentUser(request);
    if (!user) return badRequest("로그인이 필요합니다.", 401);
    const body = await request.json() as { password?: string; confirm?: string };
    if (body.confirm !== "DELETE_ACCOUNT" || typeof body.password !== "string") return badRequest("탈퇴 확인과 비밀번호를 입력해 주세요.");
    const db = database();
    const stored = await db.prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").bind(user.id).first<Stored>();
    if (!stored || !(await verifyPassword(body.password, stored.password_salt, stored.password_hash))) return badRequest("비밀번호가 올바르지 않습니다.", 401);
    await db.batch([
      db.prepare("DELETE FROM drafts WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM workspaces WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM user_consents WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
      db.prepare("DELETE FROM login_attempts WHERE phone = ?").bind(user.phone),
      db.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
    ]);
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return serverError(error);
  }
}
