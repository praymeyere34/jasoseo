"use client";

import { useEffect, useState } from "react";

type User = { phone: string; age: number | null; gender: string | null; militaryStatus: string | null; preferredRegions: string[]; hasAccountConsent: boolean; hasSensitiveConsent: boolean };

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.json() as Promise<{ user: User | null }>)
      .then((data) => setUser(data.user))
      .catch(() => setMessage("계정 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  async function removeAssessment() {
    if (!window.confirm("검사 응답, 경험·기본 이력, 자기소개서 초안을 모두 삭제하고 민감정보 동의를 철회할까요?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/consents", { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "sensitive", confirm: "DELETE_ASSESSMENT" }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "삭제하지 못했습니다.");
      setUser((current) => current ? { ...current, hasSensitiveConsent: false } : current);
      setMessage("검사·경험·기본 이력·초안 기록을 삭제하고 동의를 철회했습니다.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirm: "DELETE_ACCOUNT" }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "탈퇴하지 못했습니다.");
      window.location.assign("/");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "탈퇴하지 못했습니다.");
      setBusy(false);
    }
  }

  return <div className="privacy-shell"><header className="privacy-header"><a href="/" className="privacy-brand">이어쓰기<span className="brand-dot">.</span></a><a href="/privacy" className="privacy-back">개인정보 처리 안내</a></header><main className="privacy-main"><div className="section-kicker">ACCOUNT &amp; DATA</div><h1>개인정보 관리</h1>{loading ? <p>계정을 확인하는 중입니다.</p> : !user ? <p>로그인이 필요합니다. <a href="/">로그인 화면으로 가기</a></p> : <><p className="privacy-lead">{user.phone} 계정의 동의와 저장된 기록을 관리합니다.</p>{message && <div className="message" role="status">{message}</div>}<section className="privacy-section"><h2>가입 정보</h2><p>나이·성별: {user.age ? `만 ${user.age}세` : "미등록"} · {user.gender === "male" ? "남성" : user.gender === "female" ? "여성" : "미등록"}<br />{user.gender === "male" && <>군필 여부: {user.militaryStatus === "completed" ? "군필" : "군필 아님"}<br /></>}취업 희망 지역: {user.preferredRegions.length ? user.preferredRegions.map((region, index) => `${index + 1}순위 ${region}`).join(" · ") : "미등록"}</p></section><section className="privacy-section"><h2>동의 상태</h2><p>계정 개인정보: {user.hasAccountConsent ? "동의함" : "동의 확인 필요"}<br />검사 민감정보: {user.hasSensitiveConsent ? "동의함" : "동의하지 않음"}</p></section><section className="privacy-section"><h2>검사 동의 철회</h2><p>철회하면 검사 응답, 경험·기본 이력, 자기소개서 초안을 함께 삭제합니다. 계정은 유지됩니다.</p><button type="button" className="button outline" disabled={busy || !user.hasSensitiveConsent} onClick={removeAssessment}>검사 기록 삭제 및 동의 철회</button></section><section className="privacy-section"><h2>회원 탈퇴</h2><p>계정, 검사 응답, 경험·기본 이력, 자기소개서 초안을 삭제합니다. 복구할 수 없습니다.</p><form onSubmit={removeAccount} className="account-delete-form"><label htmlFor="delete-password">비밀번호 확인</label><input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><label className="consent-check"><input type="checkbox" checked={confirmDelete} onChange={(event) => setConfirmDelete(event.target.checked)} /><span>계정과 저장된 자료의 삭제를 확인했습니다.</span></label><button type="submit" className="button account-delete-button" disabled={busy || !confirmDelete || !password}>회원 탈퇴</button></form></section></>}</main></div>;
}
