import { badRequest, currentUser, database, sameOrigin, serverError } from "../../../lib/server";
import { cleanWorkspace, decodeAnswers, EMPTY_WORKSPACE, encodeAnswers, deriveTraits } from "../../../lib/writing";
import { consentState } from "../../../lib/consents";

type Stored = { answers: string; stories: string; background: string; company: string; position: string; question: string };

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return badRequest("로그인이 필요합니다.", 401);
    const row = await database().prepare("SELECT answers, stories, background, company, position, question FROM workspaces WHERE user_id = ?")
      .bind(user.id).first<Stored>();
    if (!row) return Response.json({ workspace: EMPTY_WORKSPACE }, { headers: { "Cache-Control": "no-store, private" } });
    const workspace = cleanWorkspace({ answers: decodeAnswers(JSON.parse(row.answers)), stories: JSON.parse(row.stories), background: JSON.parse(row.background), company: row.company, position: row.position, question: row.question });
    return Response.json({ workspace: workspace ?? EMPTY_WORKSPACE }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const user = await currentUser(request);
    if (!user) return badRequest("로그인이 필요합니다.", 401);
    const consents = await consentState(user.id);
    if (!consents.hasAccountConsent || !consents.hasSensitiveConsent) return badRequest("개인정보와 검사 응답 동의를 먼저 완료해 주세요.", 403);
    const workspace = cleanWorkspace(await request.json());
    if (!workspace) return badRequest("입력 내용을 확인해 주세요.");
    const traits = deriveTraits(workspace.answers).map((trait) => trait.key);
    await database().prepare(
      "INSERT INTO workspaces (user_id, answers, traits, stories, background, company, position, question, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET answers = excluded.answers, traits = excluded.traits, stories = excluded.stories, background = excluded.background, company = excluded.company, position = excluded.position, question = excluded.question, updated_at = excluded.updated_at",
    ).bind(user.id, encodeAnswers(workspace.answers), JSON.stringify(traits), JSON.stringify(workspace.stories), JSON.stringify(workspace.background), workspace.company, workspace.position, workspace.question, Math.floor(Date.now() / 1000)).run();
    return Response.json({ workspace });
  } catch (error) {
    return serverError(error);
  }
}
