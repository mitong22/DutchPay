"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import BrandLogo from "../brandLogo";
import styles from "../app.module.css";
import { readInviteResponse } from "@/lib/groupDraftStore";

export default function InvitePage({ inviteToken }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [invite, setInvite] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const joinedCount = invite ? invite.participants.length + 1 : 0;
  const isFull = invite && joinedCount >= invite.expectedMemberCount;

  useEffect(() => {
    let isCancelled = false;

    async function loadInvite() {
      try {
        const response = await fetch(
          `/api/invites?token=${encodeURIComponent(inviteToken)}`,
          { cache: "no-store" },
        );
        const nextInvite = await readInviteResponse(response);

        if (!isCancelled) {
          setInvite(nextInvite);
          setValidationMessage("");
        }
      } catch (error) {
        if (!isCancelled) {
          setValidationMessage(error.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadInvite();
    const intervalId = window.setInterval(loadInvite, 1000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [inviteToken]);

  function leaveInvite() {
    router.push("/");
  }

  async function joinGroup(event) {
    event.preventDefault();
    const name = nickname.trim();

    if (!name) {
      setValidationMessage("사용할 별명을 입력해 주세요.");
      return;
    }

    if (isFull) {
      setValidationMessage("예정된 인원이 모두 참여했어요.");
      return;
    }

    setIsJoining(true);

    try {
      const response = await fetch("/api/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken, nickname: name }),
      });
      const nextInvite = await readInviteResponse(response);

      setInvite(nextInvite);
      setNickname("");
      setValidationMessage("");
    } catch (error) {
      setValidationMessage(error.message);
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <div className={styles.pageShell}>
      <header className={styles.header}>
        <button className={styles.brand} type="button" onClick={leaveInvite}>
          <BrandLogo />
        </button>
        <span className={styles.inviteHeaderLabel}>초대 참여</span>
      </header>

      <main className={styles.inviteMain}>
        <section className={`${styles.card} ${styles.inviteCard}`}>
          {isLoading ? (
            <div className={styles.inviteState}>
              <span aria-hidden="true">···</span>
              <h1>초대 정보를 확인하고 있어요</h1>
            </div>
          ) : !invite ? (
            <div className={styles.inviteState}>
              <span aria-hidden="true">!</span>
              <h1>초대 링크를 확인할 수 없어요</h1>
              <p>{validationMessage || "총대에게 새 초대 링크를 받아 주세요."}</p>
              <button className={styles.secondaryButton} type="button" onClick={leaveInvite}>
                메인으로
              </button>
            </div>
          ) : invite.currentMember ? (
            <div className={styles.inviteState}>
              <span aria-hidden="true">✓</span>
              <p className={styles.eyebrow}>사용자 확인 완료</p>
              <h1>
                {invite.currentMember.id === invite.captain.id
                  ? `${invite.currentMember.nickname}님은 이미 총대로 참여 중이에요`
                  : `${invite.currentMember.nickname}님으로 이미 참여 중이에요`}
              </h1>
              <p>
                {invite.currentMember.memberType === "guest"
                  ? "이 브라우저의 비회원 세션을 확인했어요."
                  : "현재 로그인된 목업 계정을 확인했어요."}
              </p>
              <div className={styles.joinCountBadge}>
                {joinedCount} / {invite.expectedMemberCount}명 참여 완료
              </div>
              {invite.status === "ACTIVE" ? (
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => router.push(`/groups/${encodeURIComponent(invite.groupId)}`)}
                >
                  모임 화면 열기
                </button>
              ) : invite.currentMember.id === invite.captain.id ? (
                <button className={styles.secondaryButton} type="button" onClick={leaveInvite}>
                  내 정산으로 돌아가기
                </button>
              ) : (
                <p>총대가 모임을 시작하면 이 화면에서 바로 들어갈 수 있어요.</p>
              )}
            </div>
          ) : invite.status !== "WAITING" ? (
            <div className={styles.inviteState}>
              <span aria-hidden="true">✓</span>
              <h1>이미 시작된 모임이에요</h1>
              <p>총대에게 현재 모임 화면을 확인해 달라고 해 주세요.</p>
            </div>
          ) : isFull ? (
            <div className={styles.inviteState}>
              <span aria-hidden="true">✓</span>
              <h1>모두 참여했어요</h1>
              <p>총대가 곧 모임을 시작할 수 있어요.</p>
            </div>
          ) : (
            <>
              <div className={styles.intro}>
                <p className={styles.eyebrow}>모임 초대</p>
                <h1>{invite.groupName}</h1>
                <p>{invite.captain.nickname}님이 함께 정산하자고 초대했어요.</p>
              </div>

              <dl className={styles.summary}>
                <div>
                  <dt>현재 참여</dt>
                  <dd>{joinedCount} / {invite.expectedMemberCount}명</dd>
                </div>
                <div>
                  <dt>총대</dt>
                  <dd>{invite.captain.nickname}</dd>
                </div>
              </dl>

              <form className={styles.inviteJoinForm} onSubmit={joinGroup}>
                <label className={styles.fieldLabel} htmlFor="invite-nickname">
                  참여할 별명
                </label>
                <input
                  className={styles.textInput}
                  id="invite-nickname"
                  type="text"
                  value={nickname}
                  maxLength={20}
                  placeholder="별명을 입력해 주세요"
                  autoComplete="nickname"
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setValidationMessage("");
                  }}
                />
                <p className={styles.identityNotice}>
                  로그인하지 않아도 이 브라우저의 비회원 세션으로 다시 알아봐요.
                </p>
                {validationMessage && (
                  <p className={styles.errorMessage} role="alert">
                    {validationMessage}
                  </p>
                )}
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={isJoining}
                >
                  {isJoining ? "참여 확인 중..." : "초대 참여하기"}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
