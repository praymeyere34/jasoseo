import { badRequest, currentUser, database, sameOrigin, serverError } from "../../../../lib/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const user = await currentUser(request);
    if (!user) return badRequest("로그인이 필요합니다.", 401);
    const { id } = await context.params;
    const body = await request.json() as { content?: string };
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content || content.length > 10000) return badRequest("본문은 1~10000자로 입력해 주세요.");
    const result = await database().prepare("UPDATE drafts SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(content, Math.floor(Date.now() / 1000), id, user.id).run();
    if (!result.meta.changes) return badRequest("초안을 찾을 수 없습니다.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
