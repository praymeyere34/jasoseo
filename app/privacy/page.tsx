import { ACCOUNT_NOTICE, AI_PROVIDER_NOTICE, SENSITIVE_NOTICE, SMS_PROVIDER_NOTICE } from "../../lib/privacy";

export const metadata = { title: "개인정보 처리 안내 | 이어쓰기" };

export default function PrivacyPage() {
  return <div className="privacy-shell">
    <header className="privacy-header"><a href="/" className="privacy-brand">이어쓰기<span className="brand-dot">.</span></a><a href="/" className="privacy-back">서비스로 돌아가기</a></header>
    <main className="privacy-main">
      <div className="section-kicker">PERSONAL INFORMATION</div>
      <h1>개인정보 처리 안내</h1>
      <p className="privacy-date">시행일: 2026년 9월 23일 · 서비스: 이어쓰기</p>
      <p className="privacy-lead">이어쓰기는 계정 유지와 검사·자기소개서 작성 기능을 위해 아래 정보를 처리합니다. 가입과 검사 시작 전에 각각 동의를 받으며, 동의 기록의 종류·버전·일시를 계정에 저장합니다.</p>
      <section className="privacy-section"><h2>1. 계정 정보</h2><dl><div><dt>목적</dt><dd>{ACCOUNT_NOTICE.purpose}</dd></div><div><dt>수집 항목</dt><dd>{ACCOUNT_NOTICE.items}</dd></div><div><dt>보유기간</dt><dd>{ACCOUNT_NOTICE.retention}</dd></div><div><dt>동의 거부</dt><dd>{ACCOUNT_NOTICE.refusal}</dd></div></dl><p>{SMS_PROVIDER_NOTICE} 비밀번호 원문은 저장하지 않고, 검증용 해시와 솔트를 저장합니다. 취업 희망 지역은 동 단위까지만 입력하며 상세 주소는 수집하지 않습니다. 군필 여부는 남성 가입자에게만 입력받습니다.</p></section>
      <section className="privacy-section"><h2>2. 역량파악 검사와 경험·기본 이력</h2><dl><div><dt>목적</dt><dd>{SENSITIVE_NOTICE.purpose}</dd></div><div><dt>수집 항목</dt><dd>{SENSITIVE_NOTICE.items}</dd></div><div><dt>보유기간</dt><dd>{SENSITIVE_NOTICE.retention}</dd></div><div><dt>동의 거부</dt><dd>{SENSITIVE_NOTICE.refusal}</dd></div></dl><p>검사의 10번 문항도 필수이며 점수에서는 제외됩니다. 기본 이력은 선택 입력입니다. 거주지는 동까지만 적고 번지와 상세 주소는 입력하지 마세요.</p></section>
      <section className="privacy-section"><h2>3. 로그인 쿠키</h2><p>로그인 상태를 유지하기 위해 30일간 유효한 세션 쿠키를 사용합니다. 브라우저에서 쿠키를 삭제하거나 로그아웃하면 현재 브라우저의 로그인 상태가 종료됩니다.</p></section>
      <section className="privacy-section"><h2>4. AI 초안 작성</h2><p>{AI_PROVIDER_NOTICE}</p></section>
      <section className="privacy-section"><h2>5. 열람·철회·삭제</h2><p>로그인 후 <a href="/account">개인정보 관리</a>에서 검사 응답 동의를 철회하고 검사·경험·초안 기록을 삭제하거나, 비밀번호를 확인한 뒤 계정과 저장된 자료를 삭제할 수 있습니다. 삭제된 기록은 서비스 화면에서 복구할 수 없습니다.</p></section>
      <p className="privacy-limitation">이 안내에는 공개 문의처가 포함되어 있지 않습니다.</p>
    </main>
  </div>;
}
