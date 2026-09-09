"use client";

import { createAuthClient } from "better-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { reportClientError } from "@/lib/client-log.mjs";

const authClient = createAuthClient();

function LoginPanel({ loginError, demoEnabled }) {
  const router = useRouter();
  const [kind, setKind] = useState("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(
    loginError ? "아이디 또는 비밀번호를 확인해 주세요." : "",
  );

  async function submit(event) {
    if (kind === "login") return;
    event.preventDefault();
    setPending(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));

    const result = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });

    setPending(false);
    if (result.error) {
      setError(
        result.error.message ||
          "회원가입 정보를 확인해 주세요.",
      );
      return;
    }
    router.refresh();
  }

  return (
    <section className="login-card" aria-labelledby="login-title">
      <div className="segmented" aria-label="인증 방식">
        <button
          className={kind === "login" ? "active" : ""}
          type="button"
          onClick={() => setKind("login")}
        >
          로그인
        </button>
        <button
          className={kind === "signup" ? "active" : ""}
          type="button"
          onClick={() => setKind("signup")}
        >
          회원가입
        </button>
      </div>
      <h2 id="login-title">
        {kind === "login" ? "다시 만나 반가워요" : "몫대로 시작하기"}
      </h2>
      <p className="muted">모임장만 계정이 필요해요. 참여자는 링크로 들어올 수 있어요.</p>

      <form
        className="stack-form"
        action={kind === "login" ? "/login" : undefined}
        method={kind === "login" ? "post" : undefined}
        onSubmit={submit}
      >
        {kind === "signup" && (
          <label>
            이름
            <input name="name" required maxLength={40} placeholder="홍길동" />
          </label>
        )}
        <label>
          {kind === "login" ? "아이디 또는 이메일" : "이메일"}
          <input
            name="email"
            type={kind === "login" ? "text" : "email"}
            autoComplete={kind === "login" ? "username" : "email"}
            required
            placeholder={kind === "login" ? "아이디 또는 이메일" : "hello@example.com"}
          />
        </label>
        <label>
          비밀번호
          <input
            name="password"
            type="password"
            autoComplete={kind === "login" ? "current-password" : "new-password"}
            required
            minLength={kind === "signup" ? 8 : undefined}
            placeholder={kind === "login" ? "비밀번호" : "8자 이상"}
          />
        </label>
        {kind === "login" && demoEnabled && (
          <p className="muted">테스트 계정: 아이디 1 / 비밀번호 1</p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button wide" disabled={pending}>
          {pending
            ? "처리 중..."
            : kind === "login"
              ? "로그인"
              : "회원가입"}
        </button>
      </form>
    </section>
  );
}

function Stepper({ step }) {
  return (
    <ol className="stepper" aria-label="모임 만들기 단계">
      {["방식", "참여자", "확인"].map((label, index) => (
        <li className={step >= index + 1 ? "active" : ""} key={label}>
          <span>{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function GroupWizard({ onClose }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("");
  const [name, setName] = useState("");
  const [guestNames, setGuestNames] = useState([""]);
  const [expectedMemberCount, setExpectedMemberCount] = useState(4);
  const [created, setCreated] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function next() {
    setError("");
    if (step === 1 && !mode) return setError("정산 방식을 선택해 주세요.");
    if (step === 2 && !name.trim()) return setError("모임 이름을 입력해 주세요.");
    if (
      step === 2 &&
      mode === "TOGETHER" &&
      (!Number.isInteger(Number(expectedMemberCount)) ||
        Number(expectedMemberCount) < 2)
    ) {
      return setError("나를 포함한 전체 인원을 2명 이상 입력해 주세요.");
    }
    setStep((value) => Math.min(3, value + 1));
  }

  async function create() {
    setPending(true);
    setError("");
    const response = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        name,
        guestNames: guestNames.filter((value) => value.trim()),
        expectedMemberCount: Number(expectedMemberCount),
      }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) return setError(data.error || "모임을 만들지 못했어요.");

    if (data.invitePaths?.length) {
      setCreated({
        ...data,
        inviteUrls: data.invitePaths.map((path) => new URL(
          path,
          process.env.NEXT_PUBLIC_APP_URL || window.location.origin,
        ).toString()),
      });
    } else {
      router.push(`/groups/${data.groupId}`);
    }
  }

  async function shareInvite(url) {
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: `${name} 더치페이 초대`,
            text: "몫대로에서 먹은 메뉴를 함께 나눠요.",
            url,
          });
          return;
        } catch (error) {
          if (error.name === "AbortError") return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setError("초대 링크를 복사했어요. 카카오톡에 붙여 넣어 주세요.");
      } else {
        window.prompt("초대 링크를 길게 눌러 복사해 주세요.", url);
        setError("초대 링크를 표시했어요.");
      }
    } catch (error) {
      reportClientError(error, "invite.share", error.status);
      setError(error.message || "초대 링크를 공유하지 못했어요.");
    }
  }

  if (created) {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="modal-card invite-success" role="dialog" aria-modal="true">
          <span className="success-icon" aria-hidden="true">✓</span>
          <p className="eyebrow">모임 생성 완료</p>
          <h2>{name}</h2>
          <p>각 링크를 한 사람씩 보내 주세요. 링크 하나당 한 명만 참여할 수 있어요.</p>
          <div className="invite-link-list">
            {created.inviteUrls.map((url, index) => (
              <div key={url}>
                <label>
                  참여자 {index + 1}
                  <input readOnly value={url} onFocus={(event) => event.target.select()} />
                </label>
                <button className="secondary-button compact" type="button" onClick={() => shareInvite(url)}>공유</button>
              </div>
            ))}
          </div>
          <button
            className="primary-button wide"
            onClick={() => router.push(`/groups/${created.groupId}`)}
          >
            모임 보드로 이동
          </button>
          {error && <p className="success-message" role="status">{error}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card wizard-card" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="닫기">×</button>
        <p className="eyebrow">새 더치페이</p>
        <h2 id="wizard-title">모임 만들기</h2>
        <Stepper step={step} />

        {step === 1 && (
          <div className="choice-grid">
            <button
              type="button"
              className={`choice-card ${mode === "SOLO" ? "selected" : ""}`}
              onClick={() => setMode("SOLO")}
            >
              <span className="choice-emoji" aria-hidden="true">✍️</span>
              <strong>혼자 정리하기</strong>
              <small>내가 참여자와 영수증을 전부 입력해요</small>
            </button>
            <button
              type="button"
              className={`choice-card ${mode === "TOGETHER" ? "selected" : ""}`}
              onClick={() => setMode("TOGETHER")}
            >
              <span className="choice-emoji" aria-hidden="true">🙌</span>
              <strong>함께 정리하기</strong>
              <small>링크를 공유하고 각자 모임에 참여해요</small>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-fields">
            <label>
              모임 이름
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="토요일 저녁 모임"
                autoFocus
              />
            </label>
            {mode === "SOLO" ? (
              <div className="guest-editor">
                <div className="field-heading">
                  <span>참여자 이름</span>
                  <small>나는 자동으로 포함돼요</small>
                </div>
                {guestNames.map((guestName, index) => (
                  <div className="inline-field" key={index}>
                    <input
                      value={guestName}
                      maxLength={40}
                      aria-label={`참여자 ${index + 1}`}
                      placeholder={`친구 ${index + 1}`}
                      onChange={(event) =>
                        setGuestNames((values) =>
                          values.map((value, targetIndex) =>
                            targetIndex === index ? event.target.value : value,
                          ),
                        )
                      }
                    />
                    {guestNames.length > 1 && (
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`참여자 ${index + 1} 삭제`}
                        onClick={() =>
                          setGuestNames((values) =>
                            values.filter((_, targetIndex) => targetIndex !== index),
                          )
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setGuestNames((values) => [...values, ""])}
                  disabled={guestNames.length >= 49}
                >
                  + 참여자 추가
                </button>
              </div>
            ) : (
              <label>
                전체 인원
                <span className="input-with-suffix">
                  <input
                    type="number"
                    min="2"
                    max="50"
                    value={expectedMemberCount}
                    onChange={(event) => setExpectedMemberCount(event.target.value)}
                  />
                  <span>명 · 나 포함</span>
                </span>
              </label>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="summary-box">
            <div><span>방식</span><strong>{mode === "SOLO" ? "혼자 정리하기" : "함께 정리하기"}</strong></div>
            <div><span>모임</span><strong>{name}</strong></div>
            <div>
              <span>인원</span>
              <strong>
                {mode === "SOLO"
                  ? `${guestNames.filter((value) => value.trim()).length + 1}명`
                  : `${expectedMemberCount}명`}
              </strong>
            </div>
          </div>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="modal-actions">
          {step > 1 && (
            <button className="secondary-button" type="button" onClick={() => setStep((value) => value - 1)}>
              이전
            </button>
          )}
          {step < 3 ? (
            <button className="primary-button" type="button" onClick={next}>다음</button>
          ) : (
            <button className="primary-button" type="button" onClick={create} disabled={pending}>
              {pending ? "만드는 중..." : "모임 시작하기"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

export default function HomeClient({ user, initialGroups, loginError, demoEnabled }) {
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.refresh();
  }

  if (!user) {
    return (
      <main className="landing-shell">
        <nav className="top-nav">
          <Link href="/" className="brand"><span className="brand-mark">몫</span>몫대로</Link>
          <span className="nav-note">먹은 만큼, 정확하게</span>
        </nav>
        <div className="landing-grid">
          <section className="hero-copy">
            <p className="eyebrow">SMART DUTCH PAY</p>
            <h1>한 영수증도<br /><em>메뉴별로 정확하게.</em></h1>
            <p className="hero-description">
              삼겹살은 셋이, 소주는 둘이 먹었다면 그렇게 나눠야 하니까.
              복잡한 계산은 몫대로가 정리해요.
            </p>
            <div className="feature-row">
              <div><span>01</span><strong>메뉴별 참여자</strong><small>먹은 사람만 선택</small></div>
              <div><span>02</span><strong>자동 정산</strong><small>받고 보낼 금액 계산</small></div>
              <div><span>03</span><strong>링크 참여</strong><small>친구는 가입 없이</small></div>
            </div>
          </section>
          <LoginPanel loginError={loginError} demoEnabled={demoEnabled} />
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <nav className="top-nav dashboard-nav">
        <Link href="/" className="brand"><span className="brand-mark">몫</span>몫대로</Link>
        <div className="user-nav">
          <span><strong>{user.name}</strong><small>{user.email}</small></span>
          <button className="secondary-button compact" onClick={signOut} disabled={signingOut}>
            {signingOut ? "..." : "로그아웃"}
          </button>
        </div>
      </nav>

      <section className="dashboard-content">
        <header className="dashboard-heading">
          <div>
            <p className="eyebrow">MY DUTCH PAY</p>
            <h1>{user.name}님의 모임</h1>
            <p className="muted">영수증마다 먹은 메뉴와 정산 내역을 한눈에 확인하세요.</p>
          </div>
          <button className="primary-button" onClick={() => setShowWizard(true)}>+ 새 모임</button>
        </header>

        {initialGroups.length ? (
          <div className="group-list">
            {initialGroups.map((group) => (
              <Link className="group-card" href={`/groups/${group._id}`} key={group._id}>
                <div className="group-card-top">
                  <span className={`mode-badge ${group.mode === "SOLO" ? "solo" : "together"}`}>
                    {group.mode === "SOLO" ? "혼자" : "함께"}
                  </span>
                  <span className={`status-dot ${group.status === "WAITING" ? "waiting" : group.settlement_completed_at ? "completed" : ""}`}>
                    {group.status === "WAITING" ? "참여 대기" : group.settlement_completed_at ? "정산 완료" : "진행 중"}
                  </span>
                </div>
                <h2>{group.name}</h2>
                <p>{group.member_ids?.length ?? 0}명 참여</p>
                <footer>
                  <span>{new Date(group.created_at).toLocaleDateString("ko-KR")}</span>
                  <strong>열기 →</strong>
                </footer>
              </Link>
            ))}
            <button className="group-card add-group-card" onClick={() => setShowWizard(true)}>
              <span>+</span><strong>새 모임 만들기</strong><small>정산을 시작해 보세요</small>
            </button>
          </div>
        ) : (
          <section className="empty-groups panel">
            <span aria-hidden="true">🧾</span>
            <h2>아직 만든 모임이 없어요</h2>
            <p>첫 영수증을 메뉴별로 나눠 볼까요?</p>
            <button className="primary-button" onClick={() => setShowWizard(true)}>첫 모임 만들기</button>
          </section>
        )}
      </section>
      {showWizard && <GroupWizard onClose={() => setShowWizard(false)} />}
    </main>
  );
}
