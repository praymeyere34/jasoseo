"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpenText, Check, CheckCircle2, ChevronRight,
  Clipboard, Feather, FileText, LockKeyhole, LogOut, MapPin, Phone, Save, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import { deriveTraits, EMPTY_WORKSPACE, isResolvedAnswer, QUESTIONS, type Background, type Story, type WorkHistory, type Workspace } from "../lib/writing";
import { ACCOUNT_CONSENT_VERSION, ACCOUNT_NOTICE, AI_PROVIDER_NOTICE, SENSITIVE_CONSENT_VERSION, SENSITIVE_NOTICE } from "../lib/privacy";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../components/ui/input-otp";
import { Switch } from "../components/ui/switch";

type User = { id: string; phone: string; age: number | null; gender: string | null; militaryStatus: string | null; preferredRegions: string[]; hasAccountConsent: boolean; hasSensitiveConsent: boolean };
type Draft = { id: string; content: string; company: string; position: string; question: string; updatedAt: number };

const steps = [
  { number: 1, title: "역량파악 검사", detail: "90문항으로 성향 살펴보기" },
  { number: 2, title: "성향 분석", detail: "상위 유형과 역량 발견" },
  { number: 3, title: "경험 분석", detail: "역량을 경험과 연결하기" },
  { number: 4, title: "기본 이력", detail: "학교와 근무 이력 정리" },
  { number: 5, title: "자소서 작성", detail: "모든 자료를 한 편으로" },
];

const TEST_PAGE_SIZE = 10;
const TEST_PAGE_COUNT = Math.ceil(QUESTIONS.length / TEST_PAGE_SIZE);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "same-origin",
  });
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data as T;
}

function emptyStory(): Story {
  return { origin: "", response: "", pattern: "", situation: "", action: "", result: "", connection: "" };
}

function storyComplete(story?: Story): boolean {
  return Boolean(story?.origin && story.response && story.pattern && story.situation && story.action && story.result && story.connection);
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark"><Feather size={20} strokeWidth={2.2} /></div>
      <span>이어쓰기<span className="brand-dot">.</span></span>
    </div>
  );
}

function ConsentDetails({ kind }: { kind: "account" | "sensitive" }) {
  const notice = kind === "account" ? ACCOUNT_NOTICE : SENSITIVE_NOTICE;
  return <div className="consent-details">
    <div className="consent-details-head"><strong>{kind === "account" ? "개인정보 수집·이용 안내" : "민감정보 수집·이용 안내"}</strong><a href="/privacy" target="_blank" rel="noopener noreferrer">상세 안내 보기</a></div>
    <dl><div><dt>목적</dt><dd>{notice.purpose}</dd></div><div><dt>항목</dt><dd>{notice.items}</dd></div><div><dt>보유기간</dt><dd>{notice.retention}</dd></div><div><dt>거부 시</dt><dd>{notice.refusal}</dd></div></dl>
    {kind === "sensitive" && <p className="ai-provider-notice">{AI_PROVIDER_NOTICE}</p>}
  </div>;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"signup" | "login" | "reset">("signup");
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [verificationRequestedPhone, setVerificationRequestedPhone] = useState("");
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [accountAgreed, setAccountAgreed] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [militaryStatus, setMilitaryStatus] = useState("");
  const [preferredRegions, setPreferredRegions] = useState(["", "", ""]);
  const [onboardingStep, setOnboardingStep] = useState<3 | 4>(3);
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);
  const [step, setStep] = useState(1);
  const [questionPage, setQuestionPage] = useState(0);
  const [testIntroDone, setTestIntroDone] = useState(false);
  const [testNoticeConfirmed, setTestNoticeConfirmed] = useState(false);
  const [storyIntroDone, setStoryIntroDone] = useState(false);
  const [activeTrait, setActiveTrait] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const traits = useMemo(() => deriveTraits(workspace.answers), [workspace.answers]);
  const answeredCount = workspace.answers.filter(isResolvedAnswer).length;
  const questionStart = questionPage * TEST_PAGE_SIZE;
  const currentQuestions = QUESTIONS.slice(questionStart, questionStart + TEST_PAGE_SIZE);
  const currentPageComplete = currentQuestions.every((_, index) => {
    const answer = workspace.answers[questionStart + index];
    return isResolvedAnswer(answer);
  });
  const basicProfileComplete = Number.isInteger(Number(age)) && Number(age) >= 14 && Number(age) <= 100
    && Boolean(gender)
    && (gender !== "male" || Boolean(militaryStatus));
  const regionProfileComplete = preferredRegions.every((region) => region.trim().endsWith("동"))
    && new Set(preferredRegions.map((region) => region.trim())).size === 3;
  const storiesComplete = traits.length === 3 && traits.every((trait) => storyComplete(workspace.stories[trait.key]));

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const auth = await api<{ user: User | null }>("/api/auth/me");
        if (!active || !auth.user) return;
        setUser(auth.user);
        syncProfileInputs(auth.user);
        await loadPrivate();
      } catch {
        if (active) setError("저장된 내용을 불러오지 못했습니다. 새로고침해 주세요.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const timer = window.setInterval(() => setCodeCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [codeCooldown]);

  function syncProfileInputs(nextUser: User) {
    setAge(nextUser.age === null ? "" : String(nextUser.age));
    setGender(nextUser.gender === "male" || nextUser.gender === "female" ? nextUser.gender : "");
    setMilitaryStatus(nextUser.militaryStatus ?? "");
    setPreferredRegions([0, 1, 2].map((index) => nextUser.preferredRegions[index] ?? ""));
    setOnboardingStep(nextUser.age !== null && nextUser.gender && nextUser.preferredRegions.length < 3 ? 4 : 3);
  }

  async function loadPrivate() {
    const [saved, history] = await Promise.all([
      api<{ workspace: Workspace }>("/api/workspace"),
      api<{ drafts: Draft[] }>("/api/drafts"),
    ]);
    setWorkspace(saved.workspace);
    setTestIntroDone(saved.workspace.answers.some(isResolvedAnswer));
    setStoryIntroDone(Object.values(saved.workspace.stories).some((story) => Object.values(story).some(Boolean)));
    const firstUnanswered = QUESTIONS.findIndex((_, index) => {
      const answer = saved.workspace.answers[index];
      return !isResolvedAnswer(answer);
    });
    setQuestionPage(firstUnanswered === -1 ? 0 : Math.floor(firstUnanswered / TEST_PAGE_SIZE));
    setDrafts(history.drafts);
    if (history.drafts.length) setDraft(history.drafts[0]);
    const completed = deriveTraits(saved.workspace.answers);
    if (completed.length === 3) {
      const filled = completed.every((trait) => {
        const story = saved.workspace.stories[trait.key];
        return storyComplete(story);
      });
      setStep(filled ? (history.drafts.length ? 5 : 4) : 3);
    }
  }

  function updateWorkspace(patch: Partial<Workspace>) {
    setWorkspace((current) => ({ ...current, ...patch }));
    setNotice("");
  }

  async function persist(nextStep?: number): Promise<boolean> {
    setError("");
    setBusy(true);
    try {
      await api("/api/workspace", { method: "PUT", body: JSON.stringify(workspace) });
      setNotice("저장했습니다.");
      if (nextStep) setStep(nextStep);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function changeQuestionPage(nextPage: number) {
    const saved = await persist();
    if (!saved) return;
    setQuestionPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (authMode === "reset") {
        if (resetStep === 1) {
          if (verificationCode.length !== 6) throw new Error("문자로 받은 6자리 인증번호를 입력해 주세요.");
          const verified = await api<{ verified: true; verificationToken: string }>("/api/auth/verification/confirm", {
            method: "POST",
            body: JSON.stringify({ phone, verificationCode, purpose: "passwordReset" }),
          });
          setVerificationToken(verified.verificationToken);
          setResetStep(2);
          setAuthNotice("휴대전화 인증이 완료됐어요. 새 비밀번호를 입력해 주세요.");
          return;
        }
        if (password !== passwordConfirm) throw new Error("새 비밀번호가 서로 일치하지 않습니다.");
        const result = await api<{ user: User }>("/api/auth/password/reset", {
          method: "POST",
          body: JSON.stringify({ phone, password, verificationToken }),
        });
        setUser(result.user);
        syncProfileInputs(result.user);
        setPassword("");
        setPasswordConfirm("");
        setVerificationCode("");
        setVerificationToken("");
        setAuthNotice("");
        await loadPrivate();
        return;
      }

      if (authMode === "signup" && signupStep === 1) {
        if (verificationCode.length !== 6) throw new Error("문자로 받은 6자리 인증번호를 입력해 주세요.");
        const verified = await api<{ verified: true; verificationToken: string }>("/api/auth/verification/confirm", {
          method: "POST",
          body: JSON.stringify({ phone, verificationCode }),
        });
        setVerificationToken(verified.verificationToken);
        setSignupStep(2);
        setAuthNotice("휴대전화 인증이 완료됐어요.");
        return;
      }

      if (authMode === "signup" && (!accountAgreed || !ageConfirmed)) throw new Error("필수 확인과 개인정보 수집·이용 동의가 필요합니다.");
      const result = await api<{ user: User }>(`/api/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(authMode === "signup" ? {
          phone,
          password,
          verificationToken,
          accountAgreed,
          ageConfirmed,
          accountConsentVersion: ACCOUNT_CONSENT_VERSION,
        } : { phone, password }),
      });
      setUser(result.user);
      syncProfileInputs(result.user);
      if (authMode === "signup") setOnboardingStep(3);
      setPassword("");
      setPasswordConfirm("");
      setVerificationCode("");
      setVerificationToken("");
      setAuthNotice("");
      await loadPrivate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function sendVerificationCode() {
    setSendingCode(true);
    setError("");
    setAuthNotice("");
    try {
      await api<{ sent: true; retryAfter: number }>("/api/auth/verification/request", {
        method: "POST",
        body: JSON.stringify({ phone, purpose: authMode === "reset" ? "passwordReset" : "signup" }),
      });
      setVerificationRequestedPhone(phone);
      setVerificationCode("");
      setVerificationToken("");
      setCodeCooldown(60);
      setAuthNotice("인증번호를 보냈습니다. 5분 안에 입력해 주세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호를 보내지 못했습니다.");
    } finally {
      setSendingCode(false);
    }
  }

  async function saveBasicProfile() {
    if (!basicProfileComplete) {
      setError("나이와 성별, 해당되는 군필 여부를 확인해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: User }>("/api/account", {
        method: "PATCH",
        body: JSON.stringify({ section: "basic", age: Number(age), gender, militaryStatus: gender === "male" ? militaryStatus : undefined }),
      });
      setUser(result.user);
      setOnboardingStep(4);
      setNotice("기본 정보를 저장했습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "기본 정보를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function savePreferredRegions() {
    if (!regionProfileComplete) {
      setError("서로 다른 취업 희망 지역 3곳을 동 단위까지 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: User }>("/api/account", {
        method: "PATCH",
        body: JSON.stringify({ section: "regions", preferredRegions: preferredRegions.map((region) => region.trim()) }),
      });
      setUser(result.user);
      setNotice("가입 정보를 모두 저장했습니다. 역량파악 검사를 시작해 보세요.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "취업 희망 지역을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptConsent(kind: "account" | "sensitive") {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ consents: { hasAccountConsent: boolean; hasSensitiveConsent: boolean } }>("/api/consents", {
        method: "POST",
        body: JSON.stringify({ kind, version: kind === "account" ? ACCOUNT_CONSENT_VERSION : SENSITIVE_CONSENT_VERSION, agreed: kind === "account" ? accountAgreed : testNoticeConfirmed, over14: ageConfirmed }),
      });
      setUser((current) => current ? { ...current, ...result.consents } : current);
      if (kind === "sensitive") setTestIntroDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "동의를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      setWorkspace(EMPTY_WORKSPACE);
      setDraft(null);
      setDrafts([]);
      setStep(1);
      setSignupStep(1);
      setOnboardingStep(3);
      setQuestionPage(0);
      setVerificationToken("");
      setAccountAgreed(false);
      setAgeConfirmed(false);
      setAge("");
      setGender("");
      setMilitaryStatus("");
      setPreferredRegions(["", "", ""]);
      setTestIntroDone(false);
      setTestNoticeConfirmed(false);
      setStoryIntroDone(false);
      setNotice("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그아웃하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function setAnswer(index: number, value: number) {
    const answers = Array.from({ length: QUESTIONS.length }, (_, i) => workspace.answers[i] ?? 0);
    answers[index] = value;
    updateWorkspace({ answers });
  }

  function setStory(key: string, field: keyof Story, value: string) {
    updateWorkspace({
      stories: {
        ...workspace.stories,
        [key]: { ...(workspace.stories[key] ?? emptyStory()), [field]: value },
      },
    });
  }

  function updateBackground(patch: Partial<Background>) {
    updateWorkspace({ background: { ...workspace.background, ...patch } });
  }

  function updateWorkHistory(index: number, patch: Partial<WorkHistory>) {
    updateBackground({ workHistory: workspace.background.workHistory.map((entry, item) => item === index ? { ...entry, ...patch } : entry) });
  }

  async function generate() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await api<{ draft: Draft }>("/api/generate", {
        method: "POST",
        body: JSON.stringify(workspace),
      });
      setDraft(result.draft);
      setDrafts((current) => [result.draft, ...current]);
      setNotice("자기소개서 초안을 만들었습니다. 사실관계를 확인하고 문장을 다듬어 주세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "초안을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify({ content: draft.content }) });
      setDrafts((current) => current.map((item) => item.id === draft.id ? draft : item));
      setNotice("수정한 초안을 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "초안을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function copyDraft() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.content);
      setNotice("본문을 복사했습니다.");
    } catch {
      setError("복사하지 못했습니다. 본문을 선택해 직접 복사해 주세요.");
    }
  }

  if (loading) return <div className="boot"><div className="boot-mark"><Feather size={26} /></div><span>작업 공간을 여는 중...</span></div>;

  if (!user) {
    const verificationScreen = (authMode === "signup" && signupStep === 1) || (authMode === "reset" && resetStep === 1);
    const passwordScreen = authMode === "login" || (authMode === "signup" && signupStep === 2) || (authMode === "reset" && resetStep === 2);
    return (
      <div className="auth-shell">
        <header className="auth-header"><Brand /><span className="header-note">나의 경험에서 시작하는 자기소개서</span></header>
        <main className="auth-main">
          <section className="auth-story">
            <div className="eyebrow"><span className="eyebrow-line" /> MY STORY, IN MY WORDS</div>
            <h1>나를 알아가는 과정이<br /><em>좋은 자소서</em>가 됩니다.</h1>
            <p className="auth-lead">성향을 살펴보고, 강점을 발견하고, 경험을 엮어 보세요. 빈 화면 앞에서 막막했던 첫 문장을 함께 시작합니다.</p>
            <div className="flow-preview">
              {steps.map((item, index) => (
                <div className="flow-item" key={item.number}>
                  <span className="flow-number">0{item.number}</span>
                  <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                  {index < steps.length - 1 && <ChevronRight size={17} />}
                </div>
              ))}
            </div>
          </section>
          <section className="auth-panel">
            <div className="auth-panel-top"><span className="panel-kicker">START YOUR STORY</span><div className="panel-icon"><Feather size={22} /></div></div>
            <h2>{authMode === "signup" ? signupStep === 1 ? "휴대폰부터 확인할게요." : "계정을 만들어 볼까요?" : authMode === "reset" ? resetStep === 1 ? "비밀번호를 다시 설정할게요." : "새 비밀번호를 정해 주세요." : "다시 만나서 반가워요."}</h2>
            <p>{authMode === "signup" ? signupStep === 1 ? "입력한 번호로 6자리 인증번호를 보내드려요." : "비밀번호와 필수 동의만 마치면 계정이 만들어져요." : authMode === "reset" ? resetStep === 1 ? "가입한 휴대전화 번호를 인증해 주세요." : "앞으로 로그인할 때 사용할 비밀번호예요." : "지난번에 기록한 경험부터 이어서 작성할 수 있어요."}</p>
            {authMode === "reset" ? <button type="button" className="button quiet auth-mode-back" onClick={() => { setAuthMode("login"); setResetStep(1); setPassword(""); setPasswordConfirm(""); setVerificationCode(""); setVerificationToken(""); setVerificationRequestedPhone(""); setCodeCooldown(0); setError(""); setAuthNotice(""); }}><ArrowLeft size={15} /> 로그인으로 돌아가기</button> : <div className="auth-tabs" role="tablist" aria-label="계정 메뉴">
              <button type="button" role="tab" aria-selected={authMode === "signup"} className={authMode === "signup" ? "selected" : ""} onClick={() => { setAuthMode("signup"); setSignupStep(1); setPassword(""); setPasswordConfirm(""); setError(""); setAuthNotice(""); }}>회원가입</button>
              <button type="button" role="tab" aria-selected={authMode === "login"} className={authMode === "login" ? "selected" : ""} onClick={() => { setAuthMode("login"); setPassword(""); setPasswordConfirm(""); setError(""); setAuthNotice(""); }}>로그인</button>
            </div>}
            {authMode === "signup" && <div className="signup-progress" aria-label={`회원가입 ${signupStep}단계, 전체 4단계`}><div><strong>{signupStep}</strong><span>/ 4</span></div><div className="signup-progress-track"><span style={{ width: `${signupStep * 25}%` }} /></div><small>{signupStep === 1 ? "휴대폰 인증" : "계정 만들기"}</small></div>}
            {authMode === "reset" && <div className="signup-progress" aria-label={`비밀번호 재설정 ${resetStep}단계, 전체 2단계`}><div><strong>{resetStep}</strong><span>/ 2</span></div><div className="signup-progress-track"><span style={{ width: `${resetStep * 50}%` }} /></div><small>{resetStep === 1 ? "본인 확인" : "비밀번호 변경"}</small></div>}
            <form onSubmit={submitAuth} className="auth-form">
              {(authMode === "login" || verificationScreen) && <><label htmlFor="phone">휴대전화 번호</label><div className="phone-verify-row"><div className="input-icon"><Phone size={18} /><input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" value={phone} onChange={(event) => { const next = event.target.value; setPhone(next); if (verificationRequestedPhone && next !== verificationRequestedPhone) { setVerificationRequestedPhone(""); setVerificationCode(""); setVerificationToken(""); setCodeCooldown(0); setAuthNotice(""); } }} required /></div>{verificationScreen && <button type="button" className="button outline verification-send" onClick={sendVerificationCode} disabled={busy || sendingCode || codeCooldown > 0 || !phone.trim()}>{sendingCode ? "전송 중" : codeCooldown > 0 ? `${codeCooldown}초` : verificationRequestedPhone ? "다시 받기" : "인증번호 받기"}</button>}</div></>}
              {verificationScreen && verificationRequestedPhone && <div className="verification-block"><label htmlFor="verification-code">문자 인증번호</label><div className="verification-entry"><ShieldCheck size={19} aria-hidden="true" /><InputOTP id="verification-code" maxLength={6} value={verificationCode} onChange={setVerificationCode} inputMode="numeric" aria-label="문자로 받은 6자리 인증번호"><InputOTPGroup className="otp-group">{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} className="otp-slot" />)}</InputOTPGroup></InputOTP></div></div>}
              {passwordScreen && <><label htmlFor="password">{authMode === "reset" ? "새 비밀번호" : "비밀번호"}</label><div className="input-icon"><LockKeyhole size={18} /><input id="password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder={authMode === "login" ? "비밀번호 입력" : "10자 이상 입력"} minLength={authMode === "login" ? undefined : 10} value={password} onChange={(event) => setPassword(event.target.value)} required /></div></>}
              {authMode === "reset" && resetStep === 2 && <><label htmlFor="password-confirm">새 비밀번호 확인</label><div className="input-icon"><LockKeyhole size={18} /><input id="password-confirm" type="password" autoComplete="new-password" placeholder="한 번 더 입력" minLength={10} value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required /></div></>}
              {authMode === "login" && <button type="button" className="auth-reset-link" onClick={() => { setAuthMode("reset"); setResetStep(1); setPassword(""); setPasswordConfirm(""); setVerificationCode(""); setVerificationToken(""); setVerificationRequestedPhone(""); setCodeCooldown(0); setError(""); setAuthNotice(""); }}>비밀번호를 잊으셨나요?</button>}
              {authMode === "signup" && signupStep === 2 && <><ConsentDetails kind="account" /><label className="consent-check"><input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} /><span>[필수] 만 14세 이상입니다.</span></label><label className="consent-check"><input type="checkbox" checked={accountAgreed} onChange={(event) => setAccountAgreed(event.target.checked)} /><span>[필수] 개인정보 수집·이용에 동의합니다.</span></label></>}
              {authNotice && <div className="message success" role="status">{authNotice}</div>}
              {error && <div className="message error" role="alert">{error}</div>}
              {authMode === "signup" && signupStep === 2 && <button type="button" className="button quiet signup-back" onClick={() => { setSignupStep(1); setPassword(""); setError(""); setAuthNotice(""); }}><ArrowLeft size={16} /> 이전</button>}
              <button type="submit" className="button primary auth-submit" disabled={busy || (authMode === "signup" && (signupStep === 1 ? verificationCode.length !== 6 : (!accountAgreed || !ageConfirmed || password.length < 10))) || (authMode === "reset" && (resetStep === 1 ? verificationCode.length !== 6 : (password.length < 10 || passwordConfirm.length < 10)))}>{busy ? "잠시만 기다려 주세요..." : authMode === "signup" ? signupStep === 1 ? "인증 완료" : "계정 만들기" : authMode === "reset" ? resetStep === 1 ? "인증 완료" : "비밀번호 변경" : "로그인하기"} <ArrowRight size={18} /></button>
            </form>
            <p className="auth-fine">{authMode === "signup" ? signupStep === 1 ? "인증번호는 5분 동안 유효합니다." : "계정 생성 후 기본 정보와 희망 지역을 나누어 입력합니다." : authMode === "reset" ? resetStep === 1 ? "인증번호는 5분 동안 유효합니다." : "변경하면 다른 기기의 로그인은 종료됩니다." : "가입한 휴대전화 번호와 비밀번호를 입력해 주세요."}</p>
          </section>
        </main>
        <footer className="auth-footer">© 이어쓰기 · <a href="/privacy">개인정보 처리 안내</a></footer>
      </div>
    );
  }

  if (!user.hasAccountConsent || (!user.hasSensitiveConsent && workspace.answers.some(isResolvedAnswer))) {
    const kind = !user.hasAccountConsent ? "account" : "sensitive";
    const agreed = kind === "account" ? accountAgreed && ageConfirmed : testNoticeConfirmed;
    return <div className="auth-shell"><header className="auth-header"><Brand /></header><main className="consent-gate"><section className="auth-panel consent-panel"><div className="panel-kicker">동의 내용 확인</div><h1>{kind === "account" ? "계속 이용하려면 개인정보 처리 내용을 확인해 주세요." : "검사 응답의 처리 내용을 확인해 주세요."}</h1><p>이전에 가입한 계정에도 현재 안내 내용을 적용합니다. 동의 여부는 계정에 기록됩니다.</p><ConsentDetails kind={kind} />{kind === "account" ? <><label className="consent-check"><input type="checkbox" checked={accountAgreed} onChange={(event) => setAccountAgreed(event.target.checked)} /><span>[필수] 개인정보 수집·이용에 동의합니다.</span></label><label className="consent-check"><input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} /><span>[필수] 만 14세 이상입니다.</span></label></> : <label className="consent-check"><input type="checkbox" checked={testNoticeConfirmed} onChange={(event) => setTestNoticeConfirmed(event.target.checked)} /><span>[필수] 민감정보 수집·이용에 별도로 동의합니다.</span></label>}{error && <div className="message error" role="alert">{error}</div>}<button type="button" className="button primary auth-submit" disabled={busy || !agreed} onClick={() => acceptConsent(kind)}>동의하고 계속하기 <ArrowRight size={17} /></button><button type="button" className="button quiet consent-logout" onClick={logout}>로그아웃</button></section></main></div>;
  }

  const userBasicProfileComplete = user.age !== null && (user.gender === "male" || user.gender === "female")
    && (user.gender !== "male" || Boolean(user.militaryStatus));
  const userRegionProfileComplete = user.preferredRegions.length === 3;
  if (!userBasicProfileComplete || !userRegionProfileComplete) {
    const activeOnboardingStep = !userBasicProfileComplete ? 3 : onboardingStep;
    const visibleRegionCount = preferredRegions[0].trim().endsWith("동") ? (preferredRegions[1].trim().endsWith("동") ? 3 : 2) : 1;
    return <div className="auth-shell onboarding-shell">
      <header className="auth-header"><Brand /><button type="button" className="button quiet onboarding-logout" onClick={logout}>로그아웃</button></header>
      <main className="onboarding-main">
        <section className="auth-panel onboarding-panel">
          <div className="auth-panel-top"><span className="panel-kicker">PROFILE SETUP</span><div className="panel-icon">{activeOnboardingStep === 3 ? <UserRound size={22} /> : <MapPin size={22} />}</div></div>
          <div className="signup-progress" aria-label={`회원가입 ${activeOnboardingStep}단계, 전체 4단계`}><div><strong>{activeOnboardingStep}</strong><span>/ 4</span></div><div className="signup-progress-track"><span style={{ width: `${activeOnboardingStep * 25}%` }} /></div><small>{activeOnboardingStep === 3 ? "기본 정보" : "취업 희망 지역"}</small></div>
          {activeOnboardingStep === 3 ? <>
            <h2>기본 정보를 알려주세요.</h2>
            <p>나이와 성별은 지원자에게 맞는 자기소개서 표현과 진로 분석에 활용됩니다.</p>
            <div className="onboarding-form">
              <div className="signup-profile-grid">
                <div className="signup-field"><label htmlFor="signup-age">나이</label><input id="signup-age" type="number" inputMode="numeric" min={14} max={100} placeholder="만 나이" value={age} onChange={(event) => setAge(event.target.value)} /></div>
                <div className="signup-field"><label htmlFor="signup-gender">성별</label><select id="signup-gender" value={gender} onChange={(event) => { const next = event.target.value as "" | "male" | "female"; setGender(next); setMilitaryStatus(next === "male" ? "not_completed" : ""); }}><option value="">선택</option><option value="male">남성</option><option value="female">여성</option></select></div>
              </div>
              {gender === "male" && <div className="military-switch-row"><div><label htmlFor="military-status">군필 여부</label><span>{militaryStatus === "completed" ? "군필" : "군필 아님"}</span></div><Switch id="military-status" checked={militaryStatus === "completed"} onCheckedChange={(checked) => setMilitaryStatus(checked ? "completed" : "not_completed")} aria-label="군필 여부" /></div>}
              {error && <div className="message error" role="alert">{error}</div>}
              <button type="button" className="button primary auth-submit" disabled={busy || !basicProfileComplete} onClick={saveBasicProfile}>{busy ? "저장 중..." : "다음"}<ArrowRight size={18} /></button>
            </div>
          </> : <>
            <h2>어디에서 일하고 싶나요?</h2>
            <p>희망 지역은 향후 지역별 기업과 채용 정보를 추천하는 데 활용됩니다. 상세 주소는 받지 않습니다.</p>
            <div className="onboarding-form">
              <fieldset className="preferred-regions onboarding-regions"><legend>취업 희망 지역</legend><p>희망 순서대로 동 단위까지 입력해 주세요.</p>{preferredRegions.slice(0, visibleRegionCount).map((region, index) => <div className="ranked-region" key={index}><span>{index + 1}순위</span><input type="text" value={region} onChange={(event) => setPreferredRegions((current) => current.map((value, item) => item === index ? event.target.value : value))} placeholder="예: 서울 강남구 역삼동" maxLength={50} aria-label={`취업 희망 지역 ${index + 1}순위`} autoFocus={index === visibleRegionCount - 1 && index > 0} /></div>)}</fieldset>
              <p className="region-progress-note">{visibleRegionCount < 3 ? `${visibleRegionCount}순위 지역을 동 단위까지 입력하면 다음 칸이 열립니다.` : "세 지역을 모두 입력했습니다."}</p>
              {error && <div className="message error" role="alert">{error}</div>}
              <div className="onboarding-actions"><button type="button" className="button quiet" onClick={() => { setOnboardingStep(3); setError(""); }}><ArrowLeft size={16} /> 이전</button><button type="button" className="button primary" disabled={busy || !regionProfileComplete} onClick={savePreferredRegions}>{busy ? "저장 중..." : "검사 시작하기"}<ArrowRight size={18} /></button></div>
            </div>
          </>}
        </section>
      </main>
      <footer className="auth-footer">© 이어쓰기 · <a href="/privacy">개인정보 처리 안내</a></footer>
    </div>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <div className="header-right"><span className="save-hint"><CheckCircle2 size={15} /> 계정별로 저장됩니다</span><a className="privacy-link" href="/account">개인정보 관리</a><span className="user-phone">{user.phone}</span><button type="button" className="icon-button" title="로그아웃" aria-label="로그아웃" onClick={logout} disabled={busy}><LogOut size={18} /></button></div>
      </header>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-label">나의 자소서 여정</div>
          <nav aria-label="작성 단계" className="step-nav">
            {steps.map((item) => {
              const unlocked = item.number <= 2 || (item.number === 3 && traits.length === 3) || (item.number >= 4 && storiesComplete);
              return <button type="button" key={item.number} className={`step-nav-item ${step === item.number ? "active" : ""}`} disabled={!unlocked} onClick={() => { setStep(item.number); setError(""); setNotice(""); }}>
                <span className="step-badge">{item.number < step && unlocked ? <Check size={15} /> : item.number}</span>
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
              </button>;
            })}
          </nav>
          <div className="sidebar-bottom"><Sparkles size={18} /><p>잘 쓴 문장보다 중요한 건<br /><strong>나만의 실제 경험</strong>이에요.</p></div>
        </aside>
        <main className="workspace-main">
          <div className="mobile-progress">STEP 0{step} <span>/ 05</span></div>
          {step === 1 && !testIntroDone && <section className="content-section intro-section">
            <div className="section-kicker">STEP 01 · 역량파악 검사 시작 전 안내</div>
            <h1>왜 먼저 성향을 살펴볼까요?</h1>
            <p className="section-lead">자기소개서에 쓸 강점을 막연히 떠올리기 어려울 때, 검사는 반복되는 선택과 행동을 돌아볼 출발점이 됩니다. 결과를 정답처럼 받아들이기보다, 실제 경험으로 확인할 가설을 찾는 과정이에요.</p>
            <div className="intro-cards">
              <article><span>01 · 찾기</span><h2>내가 자주 보이는 모습 찾기</h2><p>90개 문항에 답하면 9가지 유형 중 두드러진 성향을 살펴봅니다. 유형별 1~9번 응답을 합산해 상위 세 가지를 보여드립니다.</p></article>
              <article><span>02 · 연결하기</span><h2>성향을 경험으로 확인하기</h2><p>높은 점수만으로 역량을 단정하지 않습니다. 다음 단계에서 그 성향이 드러난 상황과 직접 한 행동을 기록해 자소서의 근거를 만듭니다.</p></article>
              <article><span>03 · 응답 범위</span><h2>어떤 답이 저장되고 보이나요?</h2><p>90개 문항에 모두 답해야 결과를 볼 수 있습니다. 응답은 계정에 저장되며, 결과에는 유형별 1~9번 문항의 합산 점수만 표시됩니다.</p></article>
            </div>
            <p className="intro-note">10번 문항도 필수이며 답변은 점수에서 제외됩니다. 이 검사는 자기소개서 작성용 참고 자료이며 심리 진단이 아닙니다.</p>
            <ConsentDetails kind="sensitive" />
            <label className="intro-confirm"><input type="checkbox" checked={testNoticeConfirmed} onChange={(event) => setTestNoticeConfirmed(event.target.checked)} />[필수] 민감정보 수집·이용에 별도로 동의합니다.</label>
            <div className="section-actions"><span className="intro-duration">약 12~15분 · 중간 저장 가능</span><button type="button" className="button primary" disabled={!testNoticeConfirmed || busy} onClick={() => acceptConsent("sensitive")}>검사 시작하기 <ArrowRight size={17} /></button></div>
          </section>}
          {step === 1 && testIntroDone && <section className="content-section">
            <div className="section-top"><div className="section-kicker">STEP 01 · 역량파악 검사 90문항</div><span className="section-time">약 12~15분</span></div>
            <h1>나를 움직이는 성향은 무엇일까요?</h1>
            <p className="section-lead">최근 1~2년 동안 반복해서 보인 실제 모습에 가깝게 답해 주세요. 좋아 보이는 답보다 평소의 선택을 기준으로 하면 더 유용한 결과를 얻을 수 있어요.</p>
            <div className="test-progress"><div><strong>{answeredCount}</strong> / {QUESTIONS.length} 문항 완료</div><div className="progress-track"><span style={{ width: `${answeredCount / QUESTIONS.length * 100}%` }} /></div></div>
            <div className="test-page-row"><strong>{questionPage + 1} / {TEST_PAGE_COUNT}</strong><span>{questionStart + 1}–{Math.min(questionStart + TEST_PAGE_SIZE, QUESTIONS.length)}번 문항</span></div>
            <div className="question-list">
              {currentQuestions.map((question, offset) => {
                const index = questionStart + offset;
                return <fieldset className="question-card" key={index}>
                  <legend><span>{String(index + 1).padStart(2, "0")}</span>{question.text}</legend>
                  <div className="scale"><span>전혀 아니다</span><div className="scale-options">{[1, 2, 3, 4, 5].map((value) => <label key={value} className={workspace.answers[index] === value ? "chosen" : ""}><input type="radio" name={`question-${index}`} value={value} checked={workspace.answers[index] === value} onChange={() => setAnswer(index, value)} /><span>{value}</span></label>)}</div><span>매우 그렇다</span></div>
                </fieldset>;
              })}
            </div>
            {!currentPageComplete && <p className="page-guide">이 페이지의 문항에 모두 답하면 다음으로 이동할 수 있어요.</p>}
            <div className="section-actions test-actions"><div className="actions-right">{questionPage > 0 && <button type="button" className="button outline" onClick={() => changeQuestionPage(questionPage - 1)} disabled={busy}><ArrowLeft size={16} /> 이전</button>}<button type="button" className="button quiet" onClick={() => persist()} disabled={busy}><Save size={16} /> 임시 저장</button></div>{questionPage < TEST_PAGE_COUNT - 1 ? <button type="button" className="button primary" disabled={!currentPageComplete || busy} onClick={() => changeQuestionPage(questionPage + 1)}>다음 문항 <ArrowRight size={17} /></button> : <button type="button" className="button primary" disabled={answeredCount !== QUESTIONS.length || busy} onClick={() => persist(2)}>결과 확인하기 <ArrowRight size={17} /></button>}</div>
          </section>}
          {step === 2 && <section className="content-section">
            <div className="section-kicker">STEP 02 · 역량파악 검사 결과 분석</div>
            <h1>나에게 두드러진 세 가지 성향</h1>
            <p className="section-lead">90개 응답을 9가지 유형별로 계산해 상위 성향을 찾았어요. 각 성향을 자소서에 활용할 수 있는 역량과 연결했습니다.</p>
            <div className="result-intro"><Sparkles size={20} /><span>유형별 1~9번 문항의 점수를 합산했습니다. 10번 문항은 결과 점수에 포함되지 않습니다. 성격의 배경은 다음 단계에서 실제 경험을 통해 살펴봅니다.</span></div>
            <div className="trait-list">{traits.map((trait, index) => <article className="trait-card" key={trait.key}>
              <div className="trait-rank">0{index + 1}</div>
              <div className="trait-body"><div className="trait-heading"><span className="trait-chip">나의 역량</span><h2>{trait.ability}</h2><strong>{trait.name}</strong></div><p>{trait.description}</p><div className="trait-personality">드러나는 성향 <span>{trait.character}</span></div><div className="trait-analysis"><div><small>핵심 동기</small><p>{trait.coreMotivation}</p></div><div><small>경험 탐색 단서</small><p>{trait.reflectionHint}</p></div></div><div className="trait-score">유형 점수 <strong>{trait.rawScore} / 45</strong></div><div className="score-track"><span style={{ width: `${trait.score / 5 * 100}%` }} /></div></div>
            </article>)}</div>
            <div className="section-actions"><button type="button" className="button quiet" onClick={() => { setQuestionPage(0); setStep(1); }}><ArrowLeft size={16} /> 다시 검사하기</button><button type="button" className="button primary" onClick={() => { setStep(3); setActiveTrait(0); }}>역량과 경험 연결하기 <ArrowRight size={17} /></button></div>
          </section>}
          {step === 3 && !storyIntroDone && <section className="content-section intro-section">
            <div className="section-kicker">STEP 03 · 경험 기록 전 안내</div>
            <h1>왜 과거의 경험을 기록할까요?</h1>
            <p className="section-lead">검사 점수는 성향의 단서일 뿐, 어떤 역량을 실제로 발휘했는지 설명해 주지는 않습니다. 과거의 구체적인 장면을 떠올려야 성향이 생긴 맥락과 자소서에 담을 근거를 구분할 수 있어요.</p>
            <div className="intro-cards">
              <article><span>A · 형성 배경</span><h2>반복되는 행동의 이유 살피기</h2><p>어떤 환경에서 무엇을 중요하게 여기게 됐는지 적습니다. 성격의 원인을 확정하는 진단이 아니라, 나의 선택을 이해하기 위한 기록입니다.</p></article>
              <article><span>B · 역량 근거</span><h2>검사에서 나온 역량을 경험과 연결하기</h2><p>상위 세 가지 역량마다 실제 상황, 직접 취한 행동, 결과를 적고 어떤 행동이 그 역량의 근거인지 연결합니다. 맞는 장면이 없다면 다른 경험을 떠올려 보세요.</p></article>
              <article><span>C · 자소서 활용</span><h2>기록을 초안으로 연결하기</h2><p>선택한 성향과 여기에 적은 경험을 바탕으로 AI가 초안을 작성합니다. 기억나지 않는 내용은 지어내지 말고, 생성된 문장도 본인이 사실관계를 확인해 주세요.</p></article>
            </div>
            <p className="intro-note">이름이나 연락처 등 다른 사람의 개인정보는 입력하지 않는 편이 좋습니다.</p>
            <div className="section-actions"><button type="button" className="button quiet" onClick={() => setStep(2)}><ArrowLeft size={16} /> 결과로 돌아가기</button><button type="button" className="button primary" onClick={() => setStoryIntroDone(true)}>경험 기록 시작하기 <ArrowRight size={17} /></button></div>
          </section>}
          {step === 3 && storyIntroDone && <section className="content-section">
            <div className="section-kicker">STEP 03 · 역량과 경험 분석</div>
            <h1>나의 역량은 어떤 경험에서 드러났을까요?</h1>
            <p className="section-lead">검사에서 나온 세 가지 역량을 하나씩 선택해 과거 경험과 연결합니다. 성향이 형성된 맥락을 정리하고, 실제 행동과 결과에서 그 역량의 근거를 찾아보세요.</p>
            <div className="story-tabs" role="tablist" aria-label="역량별 경험">{traits.map((trait, index) => <button type="button" role="tab" aria-selected={activeTrait === index} className={activeTrait === index ? "active" : ""} key={trait.key} onClick={() => setActiveTrait(index)}><span>0{index + 1} · {trait.name}</span>{trait.ability}{storyComplete(workspace.stories[trait.key]) && <Check size={15} />}</button>)}</div>
            {traits[activeTrait] && (() => {
              const trait = traits[activeTrait];
              const story = workspace.stories[trait.key] ?? emptyStory();
              return <div className="story-editor" key={trait.key}>
                <div className="story-editor-head"><div className="story-icon"><BookOpenText size={21} /></div><div><span>{trait.ability} · {trait.character}</span><h2>{trait.name}의 형성 과정과 실제 근거</h2></div></div>
                <div className="analysis-guide"><strong>분석 관점</strong><span>{trait.coreMotivation}</span><p>{trait.reflectionHint} 검사 결과에 맞추기보다 기억나는 사실을 그대로 적어 주세요.</p></div>
                <div className="ability-guide"><strong>검사에서 나온 역량 · {trait.ability}</strong><p>{trait.description}</p><span>이 역량을 실제로 발휘한 장면을 떠올리고, 직접 한 행동을 근거로 연결해 주세요.</span></div>
                <div className="experience-group"><div className="experience-group-title"><span>A</span><div><strong>성격 형성 경험</strong><small>이 성향이 생겨난 배경과 반복 과정을 살펴봅니다.</small></div></div>
                  <div className="story-field"><label htmlFor="origin"><span>A1</span> 어떤 환경이나 경험이 기억나나요?</label><p>가정, 학교, 관계, 역할처럼 이 성향을 처음 강하게 의식한 맥락을 적어 주세요.</p><textarea id="origin" value={story.origin} onChange={(event) => setStory(trait.key, "origin", event.target.value)} placeholder="예: 어릴 때부터 가족의 일정을 챙기는 역할을 자주 맡았습니다." maxLength={1200} rows={3} /></div>
                  <div className="story-field"><label htmlFor="response"><span>A2</span> 당시 무엇을 지키거나 얻고 싶었나요?</label><p>그때 느낀 필요와 실제로 취했던 대응을 함께 적어 주세요.</p><textarea id="response" value={story.response} onChange={(event) => setStory(trait.key, "response", event.target.value)} placeholder="예: 실수를 줄여 신뢰받고 싶어서 일정을 미리 확인하는 습관을 만들었습니다." maxLength={1200} rows={3} /></div>
                  <div className="story-field"><label htmlFor="pattern"><span>A3</span> 그 경험이 지금의 행동에 어떻게 이어졌나요?</label><p>이후 여러 상황에서 반복된 선택이나 일하는 방식을 적어 주세요.</p><textarea id="pattern" value={story.pattern} onChange={(event) => setStory(trait.key, "pattern", event.target.value)} placeholder="예: 새로운 일을 맡으면 먼저 위험 요소와 마감 일정을 정리합니다." maxLength={1200} rows={3} /></div>
                  {story.origin && story.response && story.pattern && <div className="formation-summary"><strong>내 경험에서 찾은 성격 형성 흐름</strong><div><article><small>배경과 계기</small><p>{story.origin}</p></article><ChevronRight size={18} /><article><small>필요와 대응</small><p>{story.response}</p></article><ChevronRight size={18} /><article><small>현재 행동 패턴</small><p>{story.pattern}</p></article></div><span>경험에서 찾은 하나의 해석이며 성격의 원인을 확정하는 진단은 아닙니다.</span></div>}
                </div>
                <div className="experience-group evidence-group"><div className="experience-group-title"><span>B</span><div><strong>{trait.ability} 역량 근거 경험</strong><small>이 역량을 보여주는 구체적인 상황·행동·결과를 정리합니다.</small></div></div>
                  <div className="story-field"><label htmlFor="situation"><span>B1</span> 어떤 상황이었나요?</label><p>언제, 어떤 문제나 목표가 있었는지 적어 주세요.</p><textarea id="situation" value={story.situation} onChange={(event) => setStory(trait.key, "situation", event.target.value)} placeholder="예: 팀 프로젝트에서 제출 일주일 전 핵심 자료가 부족하다는 걸 알게 되었습니다." maxLength={1200} rows={3} /></div>
                  <div className="story-field"><label htmlFor="action"><span>B2</span> 나는 무엇을 했나요?</label><p>본인이 직접 판단하고 행동한 내용을 구체적으로 적어 주세요.</p><textarea id="action" value={story.action} onChange={(event) => setStory(trait.key, "action", event.target.value)} placeholder="예: 필요한 자료를 나누어 찾고, 팀원과 매일 진행 상황을 공유했습니다." maxLength={1200} rows={3} /></div>
                  <div className="story-field"><label htmlFor="result"><span>B3</span> 결과와 배운 점은 무엇인가요?</label><p>확인할 수 있는 결과와 이후 달라진 점을 적어 주세요.</p><textarea id="result" value={story.result} onChange={(event) => setStory(trait.key, "result", event.target.value)} placeholder="예: 발표를 제때 마쳤고, 이후에는 자료 수집 일정을 더 일찍 잡게 되었습니다." maxLength={1200} rows={3} /></div>
                  <div className="story-field"><label htmlFor="connection"><span>B4</span> 이 경험이 ‘{trait.ability}’와 어떻게 연결되나요?</label><p>앞서 적은 행동과 결과 중 이 역량을 보여주는 근거를 짚어 주세요. 연결되는 장면이 없다면 다른 경험을 선택해 주세요.</p><textarea id="connection" value={story.connection} onChange={(event) => setStory(trait.key, "connection", event.target.value)} placeholder="예: 문제를 발견한 뒤 자료를 다시 확인하고 작업 순서를 조정한 행동이 이 역량을 보여줍니다." maxLength={1200} rows={3} /></div>
                  {story.situation && story.action && story.result && story.connection && <div className="ability-connection"><strong>경험과 연결한 역량 · {trait.ability}</strong><p>{story.connection}</p></div>}
                </div>
              </div>;
            })()}
            <div className="section-actions"><button type="button" className="button quiet" onClick={() => persist()} disabled={busy}><Save size={16} /> 임시 저장</button><div className="actions-right">{activeTrait < 2 && <button type="button" className="button outline" onClick={async () => { if (await persist()) setActiveTrait(activeTrait + 1); }}>다음 성향 <ArrowRight size={16} /></button>}<button type="button" className="button primary" disabled={!storiesComplete || busy} onClick={() => persist(4)}>기본 이력 정리하기 <ArrowRight size={17} /></button></div></div>
          </section>}
          {step === 4 && <section className="content-section">
            <div className="section-kicker">STEP 04 · 기본 이력</div>
            <h1>경험의 배경이 되는 이력을 적어 주세요.</h1>
            <p className="section-lead">학교와 알바·직장 경험은 앞서 적은 역량 경험의 맥락을 더 분명하게 해 줍니다. 기억나는 사실만 적어 주세요. 모든 항목은 선택 사항이며, 문항에 관련된 내용만 자소서에 활용합니다.</p>
            <div className="target-card background-card"><div className="target-card-head"><BookOpenText size={20} /><h2>거주지와 학교</h2></div>
              <div className="form-field"><label htmlFor="residence-dong">사는 곳 · 동까지 (선택)</label><input id="residence-dong" placeholder="예: 서울 관악구 봉천동" value={workspace.background.residenceDong} maxLength={80} onChange={(event) => updateBackground({ residenceDong: event.target.value })} /><p className="field-help">번지, 건물명, 상세 주소는 적지 마세요.</p></div>
              <div className="target-grid"><div className="form-field"><label htmlFor="school">학교 (선택)</label><input id="school" placeholder="예: ○○대학교 또는 ○○고등학교" value={workspace.background.school} maxLength={100} onChange={(event) => updateBackground({ school: event.target.value })} /></div><div className="form-field"><label htmlFor="major">전공·학과 (선택)</label><input id="major" placeholder="예: 경영학과" value={workspace.background.major} maxLength={100} onChange={(event) => updateBackground({ major: event.target.value })} /></div></div>
              <div className="form-field"><label htmlFor="education-status">학적 상태 (선택)</label><input id="education-status" placeholder="예: 재학 중, 졸업, 휴학 중" value={workspace.background.educationStatus} maxLength={80} onChange={(event) => updateBackground({ educationStatus: event.target.value })} /></div>
            </div>
            <div className="target-card background-card"><div className="target-card-head"><FileText size={20} /><h2>알바·직장·인턴 이력</h2></div><p className="background-intro">일했던 곳과 맡은 일을 적어 주세요. 단순 목록보다 실제로 한 일과 배운 점이 초안에 도움이 됩니다.</p>
              {workspace.background.workHistory.map((work, index) => <div className="work-history-card" key={index}>
                <div className="work-history-head"><strong>경력 {index + 1}</strong><button type="button" className="button quiet" onClick={() => updateBackground({ workHistory: workspace.background.workHistory.filter((_, item) => item !== index) })}>삭제</button></div>
                <div className="target-grid"><div className="form-field"><label htmlFor={`work-kind-${index}`}>구분</label><select id={`work-kind-${index}`} value={work.kind} onChange={(event) => updateWorkHistory(index, { kind: event.target.value as WorkHistory["kind"] })}><option>직장</option><option>아르바이트</option><option>인턴</option><option>기타</option></select></div><div className="form-field"><label htmlFor={`work-organization-${index}`}>일한 곳</label><input id={`work-organization-${index}`} placeholder="예: 카페, 회사명" value={work.organization} maxLength={100} onChange={(event) => updateWorkHistory(index, { organization: event.target.value })} /></div></div>
                <div className="target-grid"><div className="form-field"><label htmlFor={`work-period-${index}`}>기간</label><input id={`work-period-${index}`} placeholder="예: 2024.03~2024.12" value={work.period} maxLength={80} onChange={(event) => updateWorkHistory(index, { period: event.target.value })} /></div><div className="form-field"><label htmlFor={`work-role-${index}`}>담당 역할</label><input id={`work-role-${index}`} placeholder="예: 매장 운영, 고객 응대" value={work.role} maxLength={100} onChange={(event) => updateWorkHistory(index, { role: event.target.value })} /></div></div>
                <div className="form-field"><label htmlFor={`work-description-${index}`}>했던 일과 배운 점</label><textarea id={`work-description-${index}`} rows={3} placeholder="본인이 직접 한 업무와 기억나는 결과를 적어 주세요." value={work.description} maxLength={600} onChange={(event) => updateWorkHistory(index, { description: event.target.value })} /></div>
              </div>)}
              {workspace.background.workHistory.length < 8 && <button type="button" className="button outline add-work" onClick={() => updateBackground({ workHistory: [...workspace.background.workHistory, { kind: "아르바이트", organization: "", period: "", role: "", description: "" }] })}>+ 이력 추가</button>}
            </div>
            <div className="section-actions"><button type="button" className="button quiet" onClick={() => setStep(3)}><ArrowLeft size={16} /> 경험으로 돌아가기</button><div className="actions-right"><button type="button" className="button outline" onClick={() => persist()} disabled={busy}><Save size={16} /> 임시 저장</button><button type="button" className="button primary" onClick={() => persist(5)} disabled={busy}>자소서 작성으로 <ArrowRight size={17} /></button></div></div>
          </section>}
          {step === 5 && <section className="content-section">
            <div className="section-kicker">STEP 05 · 자소서 작성</div>
            <h1>이제 하나의 이야기로 엮어 볼게요.</h1>
            <p className="section-lead">지원할 곳과 문항을 알려 주세요. 역량파악 검사 결과, 성격 형성 과정, 세 가지 역량 경험과 입력한 기본 이력을 바탕으로 초안을 만듭니다.</p>
            <div className="target-card"><div className="target-card-head"><FileText size={20} /><h2>지원 정보</h2></div><div className="target-grid"><div className="form-field"><label htmlFor="company">지원 회사</label><input id="company" placeholder="예: 지원 회사명" value={workspace.company} maxLength={100} onChange={(event) => updateWorkspace({ company: event.target.value })} /></div><div className="form-field"><label htmlFor="position">지원 직무</label><input id="position" placeholder="예: 서비스 기획" value={workspace.position} maxLength={100} onChange={(event) => updateWorkspace({ position: event.target.value })} /></div></div><div className="form-field"><label htmlFor="prompt">자기소개서 문항</label><textarea id="prompt" rows={3} placeholder="예: 지원 직무에 필요한 역량과 이를 발휘한 경험을 작성해 주세요." value={workspace.question} maxLength={500} onChange={(event) => updateWorkspace({ question: event.target.value })} /></div></div>
            <div className="generate-bar"><div><strong>준비된 나의 이야기</strong><span>{traits.map((trait) => trait.name).join(" · ")}</span></div><button type="button" className="button primary" onClick={generate} disabled={busy || !workspace.company.trim() || !workspace.position.trim() || !workspace.question.trim()}><Sparkles size={17} /> {busy ? "초안을 작성하는 중..." : "AI로 초안 만들기"}</button></div>
            {draft && <div className="draft-card"><div className="draft-head"><div><span className="draft-label">MY DRAFT</span><h2>{draft.company} · {draft.position}</h2></div><span className="draft-count">{draft.content.length.toLocaleString()}자</span></div><textarea aria-label="자기소개서 초안" className="draft-editor" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} rows={15} /><div className="draft-footer"><span>경험과 성과가 사실과 맞는지 꼭 확인해 주세요.</span><div><button type="button" className="button outline" onClick={copyDraft}><Clipboard size={16} /> 복사</button><button type="button" className="button dark" onClick={saveDraft} disabled={busy}><Save size={16} /> 수정 저장</button></div></div></div>}
            {drafts.length > 1 && <div className="history"><h3>이전 초안</h3>{drafts.map((item) => <button type="button" key={item.id} className={draft?.id === item.id ? "history-item active" : "history-item"} onClick={() => setDraft(item)}><span>{item.company} · {item.position}</span><small>{new Date(item.updatedAt * 1000).toLocaleDateString("ko-KR")}</small><ChevronRight size={16} /></button>)}</div>}
          </section>}
          {error && <div className="workspace-message error" role="alert">{error}</div>}
          {notice && <div className="workspace-message success" role="status">{notice}</div>}
        </main>
        <aside className="right-panel"><div className="right-card"><div className="right-icon"><Feather size={20} /></div><span className="right-eyebrow">WRITING NOTE</span><h3>좋은 자기소개서는<br />사실에서 시작해요.</h3><p>AI가 만든 문장은 출발점이에요. 실제로 겪은 일과 내 말투에 맞게 마지막으로 꼭 다듬어 주세요.</p></div><div className="right-small"><span>현재 단계</span><strong>0{step} <em>/ 05</em></strong><div className="mini-track"><span style={{ width: `${step / 5 * 100}%` }} /></div></div></aside>
      </div>
    </div>
  );
}
