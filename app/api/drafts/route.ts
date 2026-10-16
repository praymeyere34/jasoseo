import { badRequest, currentUser, database, serverError } from "../../../lib/server";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return badRequest("로그인이 필요합니다.", 401);
    const rows = await database().prepare(
      "SELECT id, company, position, question, content, updated_at AS updatedAt FROM drafts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30",
    ).bind(user.id).all();
    return Response.json({ drafts: rows.results }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return serverError(error);
  }
}
