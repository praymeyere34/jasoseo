import { PAI_QUESTIONS } from "./pai-questions";

export const TRAITS = [
  {
    key: "type1",
    name: "1번 개혁가형",
    character: "원칙을 지키며 더 나은 방법을 찾는 성향",
    ability: "품질 개선",
    description: "기준을 세우고 오류를 바로잡아 결과의 완성도를 높이는 힘",
    coreMotivation: "올바르고 책임감 있는 사람이고 싶은 마음",
    reflectionHint: "높은 기준이나 책임을 처음 강하게 의식했던 경험을 떠올려 보세요.",
  },
  {
    key: "type2",
    name: "2번 조력가형",
    character: "필요를 살피고 관계에 온기를 더하는 성향",
    ability: "관계 형성",
    description: "상대의 필요를 알아차리고 도움을 연결해 협력을 만드는 힘",
    coreMotivation: "필요하고 소중한 사람으로 연결되고 싶은 마음",
    reflectionHint: "누군가를 돌보거나 도움을 주며 관계가 달라졌던 경험을 떠올려 보세요.",
  },
  {
    key: "type3",
    name: "3번 성취가형",
    character: "목표를 향해 효율적으로 움직이는 성향",
    ability: "목표 실행",
    description: "기대되는 결과를 빠르게 파악하고 성과로 완성하는 힘",
    coreMotivation: "가치와 능력을 성취로 증명하고 싶은 마음",
    reflectionHint: "성과나 인정이 중요해졌던 계기와 그때 익힌 행동을 떠올려 보세요.",
  },
  {
    key: "type4",
    name: "4번 개성가형",
    character: "자기다운 의미와 감정을 깊이 찾는 성향",
    ability: "창의적 표현",
    description: "경험의 고유한 의미를 발견하고 자신만의 관점으로 표현하는 힘",
    coreMotivation: "나만의 정체성과 진정성을 잃지 않고 싶은 마음",
    reflectionHint: "남들과 다르다고 느꼈거나 나다운 표현이 중요해진 경험을 떠올려 보세요.",
  },
  {
    key: "type5",
    name: "5번 탐구가형",
    character: "충분히 관찰하고 이해한 뒤 움직이는 성향",
    ability: "분석과 전문성",
    description: "정보를 깊이 탐구하고 복잡한 문제의 원리를 정리하는 힘",
    coreMotivation: "유능하고 충분히 준비된 사람이고 싶은 마음",
    reflectionHint: "혼자 관찰하고 배우는 방식이 안전하거나 유용했던 경험을 떠올려 보세요.",
  },
  {
    key: "type6",
    name: "6번 충실가형",
    character: "위험을 살피고 신뢰할 기준을 확인하는 성향",
    ability: "위험 관리",
    description: "변수를 미리 점검하고 약속과 팀을 꾸준히 지켜내는 힘",
    coreMotivation: "안전과 신뢰를 확보하고 불확실성에 대비하고 싶은 마음",
    reflectionHint: "예측하기 어려운 상황에서 미리 대비해야 했던 경험을 떠올려 보세요.",
  },
  {
    key: "type7",
    name: "7번 열정가형",
    character: "새로운 가능성을 발견하고 시도하는 성향",
    ability: "기획과 확장",
    description: "여러 선택지를 연결하고 분위기를 전환해 새로운 기회를 만드는 힘",
    coreMotivation: "자유롭게 선택하며 즐거운 가능성을 놓치지 않고 싶은 마음",
    reflectionHint: "새로운 아이디어나 선택지가 답답한 상황을 바꾸었던 경험을 떠올려 보세요.",
  },
  {
    key: "type8",
    name: "8번 도전가형",
    character: "주도권을 잡고 분명하게 행동하는 성향",
    ability: "결단과 리더십",
    description: "압박 속에서도 결정을 내리고 사람과 목표를 보호하는 힘",
    coreMotivation: "스스로를 지키며 상황에 휘둘리지 않고 싶은 마음",
    reflectionHint: "직접 나서야 했거나 누군가를 보호해야 했던 경험을 떠올려 보세요.",
  },
  {
    key: "type9",
    name: "9번 평화주의자형",
    character: "여러 관점을 수용하고 조화를 만드는 성향",
    ability: "조율과 안정",
    description: "의견의 공통점을 찾고 갈등을 낮춰 꾸준한 협업을 만드는 힘",
    coreMotivation: "관계의 평온과 내적 안정을 유지하고 싶은 마음",
    reflectionHint: "갈등을 줄이거나 사람들 사이를 연결하는 역할을 했던 경험을 떠올려 보세요.",
  },
] as const;

export const ASSESSMENT_VERSION = "pai-90-v1";

function shuffledQuestions<T>(items: readonly T[]): T[] {
  const questions = [...items];
  let seed = 20260922;
  for (let index = questions.length - 1; index > 0; index--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const selected = seed % (index + 1);
    [questions[index], questions[selected]] = [questions[selected], questions[index]];
  }
  return questions;
}

export const QUESTIONS = shuffledQuestions(PAI_QUESTIONS);

export function isResolvedAnswer(answer: number): boolean {
  return Number.isInteger(answer) && answer >= 1 && answer <= 5;
}

export function encodeAnswers(answers: number[]): string {
  return JSON.stringify({ version: ASSESSMENT_VERSION, values: answers });
}

export function decodeAnswers(value: unknown): number[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const stored = value as { version?: unknown; values?: unknown };
  return stored.version === ASSESSMENT_VERSION && Array.isArray(stored.values) ? stored.values : [];
}
export type Story = {
  origin: string;
  response: string;
  pattern: string;
  situation: string;
  action: string;
  result: string;
  connection: string;
};

export type WorkHistory = {
  kind: "직장" | "아르바이트" | "인턴" | "기타";
  organization: string;
  period: string;
  role: string;
  description: string;
};

export type Background = {
  residenceDong: string;
  school: string;
  major: string;
  educationStatus: string;
  workHistory: WorkHistory[];
};

export const EMPTY_BACKGROUND: Background = {
  residenceDong: "",
  school: "",
  major: "",
  educationStatus: "",
  workHistory: [],
};

export type Workspace = {
  answers: number[];
  stories: Record<string, Story>;
  background: Background;
  company: string;
  position: string;
  question: string;
};

export const EMPTY_WORKSPACE: Workspace = {
  answers: [],
  stories: {},
  background: EMPTY_BACKGROUND,
  company: "",
  position: "",
  question: "",
};

export function deriveTraits(answers: number[]) {
  if (answers.length !== QUESTIONS.length || answers.some((answer) => !isResolvedAnswer(answer))) return [];
  return TRAITS.map((trait, index) => {
    const values = QUESTIONS.flatMap((question, questionIndex) => {
      if (question.trait !== trait.key || !question.scored) return [];
      return [answers[questionIndex]];
    });
    const rawScore = values.reduce((sum, value) => sum + value, 0);
    return { ...trait, score: rawScore / values.length, rawScore, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 3);
}

export function cleanWorkspace(value: unknown): Workspace | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const rawAnswers = Array.isArray(input.answers) ? input.answers : [];
  if (rawAnswers.length > QUESTIONS.length || rawAnswers.some((n) => !Number.isInteger(n) || n < 0 || n > 5)) return null;
  const answers = rawAnswers.length === 0 || rawAnswers.length === QUESTIONS.length ? rawAnswers : [];
  const stories: Record<string, Story> = {};
  const rawStories = input.stories && typeof input.stories === "object" ? input.stories as Record<string, unknown> : {};
  const cleanStoryField = (fields: Record<string, unknown>, key: keyof Story) =>
    typeof fields[key] === "string" ? (fields[key] as string).trim().slice(0, 1200) : "";
  for (const trait of TRAITS) {
    const raw = rawStories[trait.key];
    if (raw && typeof raw === "object") {
      const fields = raw as Record<string, unknown>;
      stories[trait.key] = {
        origin: cleanStoryField(fields, "origin"),
        response: cleanStoryField(fields, "response"),
        pattern: cleanStoryField(fields, "pattern"),
        situation: cleanStoryField(fields, "situation"),
        action: cleanStoryField(fields, "action"),
        result: cleanStoryField(fields, "result"),
        connection: cleanStoryField(fields, "connection"),
      };
    }
  }
  const field = (key: string, max: number) => typeof input[key] === "string" ? (input[key] as string).trim().slice(0, max) : "";
  const rawBackground = input.background && typeof input.background === "object" && !Array.isArray(input.background)
    ? input.background as Record<string, unknown> : {};
  const backgroundField = (key: string, max: number) => typeof rawBackground[key] === "string"
    ? (rawBackground[key] as string).trim().slice(0, max) : "";
  const kinds = ["직장", "아르바이트", "인턴", "기타"] as const;
  const workHistory: WorkHistory[] = Array.isArray(rawBackground.workHistory)
    ? rawBackground.workHistory.slice(0, 8).filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && !Array.isArray(entry)))
      .map((entry) => {
        const workField = (key: string, max: number) => typeof entry[key] === "string" ? (entry[key] as string).trim().slice(0, max) : "";
        const kind = kinds.find((item) => item === entry.kind) ?? "기타";
        return { kind, organization: workField("organization", 100), period: workField("period", 80), role: workField("role", 100), description: workField("description", 600) };
      }).filter((entry) => entry.organization || entry.period || entry.role || entry.description)
    : [];
  const background: Background = {
    residenceDong: backgroundField("residenceDong", 80),
    school: backgroundField("school", 100),
    major: backgroundField("major", 100),
    educationStatus: backgroundField("educationStatus", 80),
    workHistory,
  };
  return { answers, stories, background, company: field("company", 100), position: field("position", 100), question: field("question", 500) };
}
