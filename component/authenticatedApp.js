"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import BrandLogo from "./brandLogo";
import GroupBoard from "./groupBoard";
import DashboardPage from "./pages/dashboardPage";
import GroupCreatePage from "./pages/groupCreatePage";
import styles from "./app.module.css";
import {
  EMPTY_DRAFT,
  getDraftParticipantNames,
  getDraftSnapshot,
  getServerDraftSnapshot,
  getSetupError,
  parseDraft,
  readInviteResponse,
  replaceDraft,
  saveDraft,
  subscribeToDraftStore,
} from "@/lib/groupDraftStore";

// fun readGroupResponse. 그룹 응답 읽어오기 및 예외 처리
async function readGroupResponse(response) {
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message ?? "모임 정보를 처리하지 못했어요.");
  }

  return result;
}

// fun AuthenticatedApp. 앱 권한 체크
export default function AuthenticatedApp({
  captain,
  groups = [],
  page = "dashboard",
  groupId = null,
  receiptId = null,
  viewer = null,
}) {

  // router 이동용 객체
  const router = useRouter();
    //  - push: 이전 페이지 기록 남기고 이동
    //  - replace: 현재 페이지 기록 교체하며 이동
    //  - refresh: 현재 페이지 서버 데이터 다시 불러오기
  
  // 변경 될 때마다 화면을 다시 그리기 위한 스냅샷
  const draftSnapshot = useSyncExternalStore(
    // groupDraftStore 정의 함수들
    subscribeToDraftStore, // 저장 데이터 변경 여부 판단
    getDraftSnapshot, // 브라우저에서 현재 저장 데이터 가져오기
    getServerDraftSnapshot, // 서버 렌더링시 사용할 기본 데이터 가져오기
  );
  const draft = parseDraft(draftSnapshot);
  const selectedGroup = groups.find((group) => group.id === groupId);

  function showDashboard() {
    router.push("/dashboard");
  }

  function startNewGroup() {
    replaceDraft({
      ...EMPTY_DRAFT,
      participantNames: [""],
      togetherParticipantNames: [],
      togetherParticipants: [],
    });
    router.push("/groups/new");
  }

  function openGroup(nextGroupId) {
    router.push(`/groups/${encodeURIComponent(nextGroupId)}`);
  }

  function openReceipt(nextReceiptId) {
    router.push(
      `/groups/${encodeURIComponent(groupId)}/receipts/${encodeURIComponent(nextReceiptId)}`,
    );
  }

  async function completeGroup(nextGroupId) {
    const response = await fetch(
      `/api/groups/${encodeURIComponent(nextGroupId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      },
    );
    const result = await readGroupResponse(response);

    router.refresh();
    return result.group;
  }

  async function createGroup() {
    const message = getSetupError(draft, captain);

    if (message) {
      saveDraft({ step: 2 });
      throw new Error(message);
    }

    let groupId;
    if (draft.mode === "TOGETHER" && draft.inviteToken) {
      const invite = await readInviteResponse(
        await fetch("/api/invites", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: draft.inviteToken }),
        }),
      );
      groupId = invite.groupId;
    } else {
      const participantNames = getDraftParticipantNames(draft);
      const participants = participantNames.map((nickname) => ({ nickname }));
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.groupName.trim(),
          mode: draft.mode,
          expectedMemberCount: participants.length + 1,
          participants,
        }),
      });
      const result = await readGroupResponse(response);
      groupId = result.group.id;
    }

    replaceDraft({ ...draft, step: 3, completed: true });
    router.push(`/groups/${encodeURIComponent(groupId)}`);
    return groupId;
  }

  async function leaveAccount() {
    if (viewer?.kind === "guest") {
      router.push("/");
      return;
    }

    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    if (response.ok) {
      router.replace("/login");
    }
  }

  const accountNickname = viewer?.nickname ?? captain.nickname;
  const isGuest = viewer?.kind === "guest";

  return (
    <div className={styles.pageShell}>
      <header className={styles.header}>
        <button className={styles.brand} type="button" onClick={showDashboard}>
          <BrandLogo />
        </button>
        <div className={styles.accountActions}>
          <div className={styles.captain}>
            <span className={styles.captainLabel}>
              {isGuest ? "비회원 참여자" : "총대 계정"}
            </span>
            <strong>{accountNickname}</strong>
          </div>
          <button className={styles.logoutButton} type="button" onClick={leaveAccount}>
            {isGuest ? "나가기" : "로그아웃"}
          </button>
        </div>
      </header>

      {page === "group" || page === "receipt" ? (
        selectedGroup ? (
          <GroupBoard
            group={selectedGroup}
            currentMemberId={viewer?.memberId ?? selectedGroup.members.find(
              (member) => member.user_id === captain.user_id,
            )?.id ?? captain.id}
            isCaptain={viewer?.isCaptain ?? true}
            receiptId={receiptId}
            onBack={isGuest ? () => router.push("/") : showDashboard}
            onBackToGroup={() => router.push(`/groups/${encodeURIComponent(selectedGroup.id)}`)}
            onComplete={() => completeGroup(selectedGroup.id)}
            onOpenReceipt={openReceipt}
          />
        ) : (
          <main className={styles.main}>
            <section className={styles.card}>
              <div className={styles.intro}>
                <p className={styles.eyebrow}>모임 상세</p>
                <h1>모임을 찾을 수 없어요</h1>
                <p>대시보드에서 저장된 모임을 다시 선택해 주세요.</p>
              </div>
              <button className={styles.primaryButton} type="button" onClick={showDashboard}>
                대시보드로
              </button>
            </section>
          </main>
        )
      ) : page === "create" ? (
        <GroupCreatePage
          captain={captain}
          draft={draft}
          onBack={showDashboard}
          onCreate={createGroup}
        />
      ) : (
        <DashboardPage
          captain={captain}
          groups={groups}
          onCreate={startNewGroup}
          onOpenGroup={openGroup}
        />
      )}
    </div>
  );
}
