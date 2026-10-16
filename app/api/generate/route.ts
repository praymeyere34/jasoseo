import { env } from "cloudflare:workers";
import { badRequest, currentUser, database, sameOrigin, serverError } from "../../../lib/server";
import { cleanWorkspace, deriveTraits, encodeAnswers, type Workspace } from "../../../lib/writing";
import { consentState } from "../../../lib/consents";

function validateForGeneration(workspace: Workspace): string | null {
  const traits = deriveTraits(workspace.answers);
  if (traits.length !== 3) return "역량파악 검사를 모두 완료해 주세요.";
  for (const trait of traits) {
    const story = workspace.stories[trait.key];
    if (!story?.origin || !story.response || !story.pattern) return `${trait.name}의 성격 형성 경험을 모두 적어 주세요.`;
    if (!story.situation || !story.action || !story.result) return `${trait.name} 역량 경험의 상황, 행동, 결과를 모두 적어 주세요.`;
    if (!story.connection) return `${trait.ability} 역량과 경험의 연결 근거를 적어 주세요.`;
  }
  if (!workspace.company || !workspace.position || !workspace.question) return "지원 회사, 직무, 문항을 입력해 주세요.";
  return null;
}

function extractText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const data = result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }> };
  const candidate = data.candidates?.[0];
  if (!candidate || (candidate.finishReason && candidate.finishReason !== "STOP")) return "";
  return candidate.content?.parts?.filter((part) => !part.thought)
    .map((part) => part.text ?? "").join("\n").trim() ?? "";
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return badRequest("허용되지 않은 요청입니다.", 403);
  try {
    const user = await currentUser(request);
    if (!user) return badRequest("로그인이 필요합니다.", 401);
    const consents = await consentState(user.id);
    if (!consents.hasAccountConsent || !consents.hasSensitiveConsent) return badRequest("개인정보와 검사 응답 동의를 먼저 완료해 주세요.", 403);
    const workspace = cleanWorkspace(await request.json());
    if (!workspace) return badRequest("입력 내용을 확인해 주세요.");
    const validation = validateForGeneration(workspace);
    if (validation) return badRequest(validation);
    if (!env.GEMINI_API_KEY) return badRequest("AI 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.", 503);

    const traits = deriveTraits(workspace.answers);
    const evidence = traits.map((trait) => {
      const story = workspace.stories[trait.key];
      return {
        검사유형: trait.name,
        역량: trait.ability,
        성향: trait.character,
        핵심동기참고: trait.coreMotivation,
        검사점수: trait.score.toFixed(1),
        성격형성경험: { 배경과계기: story.origin, 당시필요와대응: story.response, 현재반복패턴: story.pattern },
        역량근거경험: { 상황: story.situation, 행동: story.action, 결과와배움: story.result, 역량과의연결: story.connection },
      };
    });
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const completion = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "당신은 한국어 채용 자기소개서 편집자입니다. 제공된 실제 경험만 근거로 지원 문항에 직접 답하는 자기소개서 한 편을 작성하세요. 역량파악 검사 결과는 해석의 단서일 뿐 사실이나 성격 형성 원인의 증거가 아닙니다. 사용자가 기록한 형성 경험에서 반복되는 동기와 행동을 읽되 인과관계를 확정적으로 단정하지 마세요. 형성 경험은 지원 문항에 도움이 될 때만 간결하게 활용하고, 사용자가 적은 역량과 경험의 연결 근거를 실제 상황·행동·결과와 대조해 자소서에 드러내세요. 연결 근거가 경험으로 뒷받침되지 않으면 역량을 단정하지 마세요. 학교, 거주지(동), 근무 이력은 문항 및 지원 직무와 관련 있을 때만 배경으로 활용하고 단순 나열하지 마세요. 경험에 없는 수치, 성과, 역할, 배경, 동기, 회사 정보는 만들지 마세요. 불확실한 부분은 생략하세요. 자연스럽고 담백한 한국어 본문만 출력하고 제목, 해설, Markdown은 쓰지 마세요." }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({
          지원회사: workspace.company,
          지원직무: workspace.position,
          자기소개서문항: workspace.question,
          거주지및학력근무이력: workspace.background,
          검사결과및경험: evidence,
        }) }] }],
        generationConfig: { maxOutputTokens: 2400, thinkingConfig: { thinkingBudget: 512 } },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!completion.ok) {
      console.error("Gemini response", completion.status);
      if (completion.status === 429) return badRequest("AI 무료 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.", 429);
      return badRequest("AI 작성에 실패했습니다. 잠시 후 다시 시도해 주세요.", 502);
    }
    const content = extractText(await completion.json());
    if (!content) return badRequest("작성 결과가 비어 있습니다. 다시 시도해 주세요.", 502);
    const db = database();
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await db.batch([
      db.prepare("INSERT INTO workspaces (user_id, answers, traits, stories, background, company, position, question, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET answers = excluded.answers, traits = excluded.traits, stories = excluded.stories, background = excluded.background, company = excluded.company, position = excluded.position, question = excluded.question, updated_at = excluded.updated_at")
        .bind(user.id, encodeAnswers(workspace.answers), JSON.stringify(traits.map((trait) => trait.key)), JSON.stringify(workspace.stories), JSON.stringify(workspace.background), workspace.company, workspace.position, workspace.question, now),
      db.prepare("INSERT INTO drafts (id, user_id, company, position, question, traits, stories, content, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, user.id, workspace.company, workspace.position, workspace.question, JSON.stringify(traits), JSON.stringify(workspace.stories), content, now),
    ]);
    return Response.json({ draft: { id, content, company: workspace.company, position: workspace.position, question: workspace.question, updatedAt: now } });
  } catch (error) {
    return serverError(error);
  }
}
