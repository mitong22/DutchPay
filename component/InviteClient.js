"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { reportClientError } from "@/lib/client-log.mjs";

export default function InviteClient({ token, preview }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function join(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    let response;
    try {
      response = await fetch(`/api/invites/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.error || "모임에 참여하지 못했어요.");
        error.status = response.status;
        throw error;
      }
      router.push(`/groups/${data.groupId}`);
    } catch (error) {
      reportClientError(error, "invite.join", response?.status);
      setError(error.message || "모임에 참여하지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="invite-page">
      <nav className="top-nav">
        <Link href="/" className="brand"><span className="brand-mark">몫</span>몫대로</Link>
      </nav>

      {!preview ? (
        <section className="panel invite-card invalid-invite">
          <span aria-hidden="true">🔗</span>
          <h1>유효하지 않은 초대 링크예요</h1>
          <p>링크가 만료됐거나 새 링크로 교체되었어요. 모임장에게 다시 요청해 주세요.</p>
          <Link href="/" className="secondary-button">홈으로</Link>
        </section>
      ) : (
        <section className="panel invite-card">
          <p className="eyebrow">YOU ARE INVITED</p>
          <span className="invite-emoji" aria-hidden="true">🙌</span>
          <h1>{preview.groupName}</h1>
          <p>먹은 메뉴를 함께 고르고 정확하게 나눠요.</p>
          <div className="join-progress">
            <div><span style={{ width: `${Math.min(100, (preview.joinedCount / preview.expectedMemberCount) * 100)}%` }} /></div>
            <strong>{preview.joinedCount} / {preview.expectedMemberCount}명 참여</strong>
          </div>

          {preview.isFull ? (
            <p className="form-error">이미 모든 인원이 참여했어요.</p>
          ) : (
            <form className="stack-form" onSubmit={join}>
              <label>
                모임에서 사용할 닉네임
                <input
                  required
                  maxLength={40}
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="예: 민수"
                  autoFocus
                />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-button wide" disabled={pending}>
                {pending ? "참여 중..." : "가입 없이 참여하기"}
              </button>
            </form>
          )}
          <small className="privacy-note">닉네임과 정산 정보만 이 모임에 저장돼요.</small>
        </section>
      )}
    </main>
  );
}
