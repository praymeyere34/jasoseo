import { badRequest, endSession, sameOrigin, serverError } from "../../../../lib/server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    return await endSession(Response.json({ ok: true }), request);
  } catch (error) {
    return serverError(error);
  }
}
