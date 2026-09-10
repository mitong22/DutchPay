"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import BrandLogo from "./brandLogo";
import GroupBoard from "./groupBoard";
import DashboardPage from "./pages/dashboardPage";
import GroupCreatePage from "./pages/groupCreatePage";
import styles from "./app.module.css";
import {
  EMPTY_DRAFT,
  createId,
  ensureDemoData,
  getDraftParticipantNames,
  getDraftSnapshot,
  getGroupsSnapshot,
  getServerDraftSnapshot,
  getServerGroupsSnapshot,
  getSetupError,
  parseDraft,
  parseGroups,
  readInviteResponse,
  replaceDraft,
  replaceGroup,
  saveDraft,
  saveGroup,
  subscribeToDemoStore,
} from "@/lib/demoStore";

export default function AuthenticatedApp({
  captain,
  page = "dashboard",
  groupId = null,
  receiptId = null,
}) {
  const router = useRouter();
  const draftSnapshot = useSyncExternalStore(
    subscribeToDemoStore,
    getDraftSnapshot,
    getServerDraftSnapshot,
  );
  const groupsSnapshot = useSyncExternalStore(
    subscribeToDemoStore,
    getGroupsSnapshot,
    getServerGroupsSnapshot,
  );
  const draft = parseDraft(draftSnapshot);
  const groups = parseGroups(groupsSnapshot);
  const selectedGroup = groups.find((group) => group.id === groupId);

  useEffect(() => {
    ensureDemoData(captain);
  }, [captain]);

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

  function completeGroup(nextGroupId) {
    const group = groups.find((currentGroup) => currentGroup.id === nextGroupId);

    if (!group || group.status === "COMPLETED") {
      return;
    }

    replaceGroup({
      ...group,
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
    });
  }

  async function createGroup() {
    const message = getSetupError(draft, captain);

    if (message) {
      saveDraft({ step: 2 });
      return;
    }

    const now = new Date().toISOString();
    const participantNames = getDraftParticipantNames(draft);
    const invitedMembers =
      draft.mode === "TOGETHER" &&
      draft.togetherParticipants.length === participantNames.length
        ? draft.togetherParticipants.map((member) => ({
            id: member.id,
            user_id: null,
            nickname: member.nickname,
            member_type: member.memberType,
          }))
        : participantNames.map((nickname) => ({
            id: createId("mock-member"),
            user_id: null,
            nickname,
            member_type: "guest",
          }));
    const members = [
      {
        id: captain.id,
        user_id: captain.user_id,
        nickname: captain.nickname,
        member_type: captain.member_type,
      },
      ...invitedMembers,
    ];
    const group = {
      id: createId("mock-group"),
      name: draft.groupName.trim(),
      created_by: captain.user_id,
      mode: draft.mode,
      status: "ACTIVE",
      expected_member_count:
        draft.mode === "TOGETHER" ? draft.expectedMemberCount : members.length,
      created_at: now,
      activated_at: now,
      calculation_version: 1,
      members,
    };

    if (draft.mode === "TOGETHER" && draft.inviteToken) {
      try {
        await readInviteResponse(
          await fetch("/api/invites", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: draft.inviteToken }),
          }),
        );
      } catch {
        // 모임 생성 자체는 브라우저 목업 흐름을 계속 진행한다.
      }
    }

    saveGroup(group);
    replaceDraft({ ...draft, step: 3, completed: true });
    router.push(`/groups/${encodeURIComponent(group.id)}`);
  }

  async function logout() {
    const response = await fetch("/api/mock-session", { method: "DELETE" });

    if (response.ok) {
      router.replace("/login");
    }
  }

  return (
    <div className={styles.pageShell}>
      <header className={styles.header}>
        <button className={styles.brand} type="button" onClick={showDashboard}>
          <BrandLogo />
        </button>
        <div className={styles.accountActions}>
          <div className={styles.captain}>
            <span className={styles.captainLabel}>테스트 총대</span>
            <strong>{captain.nickname}</strong>
          </div>
          <button className={styles.logoutButton} type="button" onClick={logout}>
            로그아웃
          </button>
        </div>
      </header>

      {page === "group" || page === "receipt" ? (
        selectedGroup ? (
          <GroupBoard
            group={selectedGroup}
            currentMemberId={captain.id}
            receiptId={receiptId}
            onBack={showDashboard}
            onBackToGroup={() => router.back()}
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
