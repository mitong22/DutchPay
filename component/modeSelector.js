"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import GroupBoard, { calculateGroupSettlement } from "./groupBoard";
import styles from "./modeSelector.module.css";

const LEGACY_MODE_KEY = "dutchpay:group-draft:mode";
const DRAFT_KEY = "dutchpay:group-create-draft";
const ACTIVE_GROUP_KEY = "dutchpay:active-group";
const GROUPS_KEY = "dutchpay:groups";
const STORE_CHANGE_EVENT = "dutchpay-demo-store-change";
const VALID_MODES = new Set(["SOLO", "TOGETHER"]);
const MIN_TOGETHER_MEMBERS = 2;
const MAX_TOGETHER_MEMBERS = 8;

const MODES = [
  {
    id: "SOLO",
    label: "혼자하기",
    description: "내가 모든 비용을 먼저 결제하고 참여자별로 나눠요.",
    detail: "다른 참여자는 서비스에 접속하지 않아도 돼요.",
  },
  {
    id: "TOGETHER",
    label: "함께하기",
    description: "여러 명이 각각 결제한 비용을 마지막에 함께 정산해요.",
    detail: "초대 링크를 열어 각자 별명으로 참여해요.",
  },
];

const EMPTY_DRAFT = {
  step: 1,
  mode: null,
  groupName: "",
  participantNames: [""],
  expectedMemberCount: 3,
  togetherParticipantNames: [],
  togetherParticipants: [],
  inviteToken: null,
  completed: false,
};

const EMPTY_DRAFT_SNAPSHOT = JSON.stringify(EMPTY_DRAFT);
const EMPTY_GROUPS_SNAPSHOT = "[]";
const SOLO_DRAFT_SNAPSHOT = JSON.stringify({ ...EMPTY_DRAFT, mode: "SOLO" });
const TOGETHER_DRAFT_SNAPSHOT = JSON.stringify({
  ...EMPTY_DRAFT,
  mode: "TOGETHER",
});

function parseDraft(snapshot) {
  try {
    const draft = JSON.parse(snapshot);
    const expectedMemberCount = Number(draft.expectedMemberCount);

    return {
      ...EMPTY_DRAFT,
      ...draft,
      step: [1, 2, 3].includes(draft.step) ? draft.step : 1,
      mode: VALID_MODES.has(draft.mode) ? draft.mode : null,
      participantNames:
        Array.isArray(draft.participantNames) && draft.participantNames.length > 0
          ? draft.participantNames
          : [""],
      expectedMemberCount:
        Number.isInteger(expectedMemberCount) &&
        expectedMemberCount >= MIN_TOGETHER_MEMBERS &&
        expectedMemberCount <= MAX_TOGETHER_MEMBERS
          ? expectedMemberCount
          : EMPTY_DRAFT.expectedMemberCount,
      togetherParticipantNames: Array.isArray(draft.togetherParticipantNames)
        ? draft.togetherParticipantNames
        : [],
      togetherParticipants: Array.isArray(draft.togetherParticipants)
        ? draft.togetherParticipants.filter(
            (member) =>
              member &&
              typeof member.id === "string" &&
              typeof member.nickname === "string",
          )
        : [],
      inviteToken:
        typeof draft.inviteToken === "string" ? draft.inviteToken : null,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

function parseGroups(snapshot) {
  try {
    const groups = JSON.parse(snapshot);
    return Array.isArray(groups)
      ? groups.filter((group) => group && typeof group.id === "string")
      : [];
  } catch {
    return [];
  }
}

function getDraftSnapshot() {
  try {
    const snapshot = window.localStorage.getItem(DRAFT_KEY);

    if (snapshot) {
      return snapshot;
    }

    const legacyMode = window.localStorage.getItem(LEGACY_MODE_KEY);

    if (legacyMode === "SOLO") {
      return SOLO_DRAFT_SNAPSHOT;
    }

    if (legacyMode === "TOGETHER") {
      return TOGETHER_DRAFT_SNAPSHOT;
    }
  } catch {
    return EMPTY_DRAFT_SNAPSHOT;
  }

  return EMPTY_DRAFT_SNAPSHOT;
}

function getServerDraftSnapshot() {
  return EMPTY_DRAFT_SNAPSHOT;
}

function getGroupsSnapshot() {
  try {
    const storedGroups = parseGroups(
      window.localStorage.getItem(GROUPS_KEY) ?? EMPTY_GROUPS_SNAPSHOT,
    );
    const legacyGroupSnapshot = window.localStorage.getItem(ACTIVE_GROUP_KEY);

    if (!legacyGroupSnapshot) {
      return JSON.stringify(storedGroups);
    }

    const legacyGroup = JSON.parse(legacyGroupSnapshot);

    if (
      !legacyGroup?.id ||
      storedGroups.some((group) => group.id === legacyGroup.id)
    ) {
      return JSON.stringify(storedGroups);
    }

    return JSON.stringify([legacyGroup, ...storedGroups]);
  } catch {
    return EMPTY_GROUPS_SNAPSHOT;
  }
}

function getServerGroupsSnapshot() {
  return EMPTY_GROUPS_SNAPSHOT;
}

function subscribeToDemoStore(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORE_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORE_CHANGE_EVENT, callback);
  };
}

function notifyStoreChange() {
  window.dispatchEvent(new Event(STORE_CHANGE_EVENT));
}

function replaceDraft(nextDraft) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));

  if (nextDraft.mode) {
    window.localStorage.setItem(LEGACY_MODE_KEY, nextDraft.mode);
  } else {
    window.localStorage.removeItem(LEGACY_MODE_KEY);
  }

  notifyStoreChange();
}

function saveDraft(patch) {
  const currentDraft = parseDraft(getDraftSnapshot());
  replaceDraft({ ...currentDraft, ...patch });
}

function saveGroup(group) {
  const currentGroups = parseGroups(getGroupsSnapshot());
  const nextGroups = [
    group,
    ...currentGroups.filter((currentGroup) => currentGroup.id !== group.id),
  ];

  window.localStorage.setItem(GROUPS_KEY, JSON.stringify(nextGroups));
  window.localStorage.setItem(ACTIVE_GROUP_KEY, JSON.stringify(group));
  notifyStoreChange();
}

function replaceGroup(group) {
  const currentGroups = parseGroups(getGroupsSnapshot());
  const nextGroups = currentGroups.map((currentGroup) =>
    currentGroup.id === group.id ? group : currentGroup,
  );

  window.localStorage.setItem(GROUPS_KEY, JSON.stringify(nextGroups));

  const activeGroup = JSON.parse(
    window.localStorage.getItem(ACTIVE_GROUP_KEY) ?? "null",
  );

  if (activeGroup?.id === group.id) {
    window.localStorage.setItem(ACTIVE_GROUP_KEY, JSON.stringify(group));
  }

  notifyStoreChange();
}

function createId(prefix) {
  const value =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${value}`;
}

function normalizeNames(names) {
  return names.map((name) => name.trim()).filter(Boolean);
}

function getDraftParticipantNames(draft) {
  return normalizeNames(
    draft.mode === "TOGETHER"
      ? draft.togetherParticipants.length > 0
        ? draft.togetherParticipants.map((member) => member.nickname)
        : draft.togetherParticipantNames
      : draft.participantNames,
  );
}

function getSetupError(draft, captain) {
  if (!draft.groupName.trim()) {
    return "모임 이름을 입력해 주세요.";
  }

  const participantNames = getDraftParticipantNames(draft);
  const comparableNames = participantNames.map((name) => name.toLowerCase());

  if (new Set(comparableNames).size !== comparableNames.length) {
    return "참여자 별명은 서로 다르게 입력해 주세요.";
  }

  if (comparableNames.includes(captain.nickname.trim().toLowerCase())) {
    return "목업 총대와 다른 참여자 별명을 입력해 주세요.";
  }

  if (draft.mode === "TOGETHER" && !draft.inviteToken) {
    return "초대 링크를 발급하고 참여자를 받아 주세요.";
  }

  if (
    draft.mode === "TOGETHER" &&
    participantNames.length !== draft.expectedMemberCount - 1
  ) {
    return "예정된 참여자가 모두 입장해야 모임을 시작할 수 있어요.";
  }

  return "";
}

function getInviteUrl(inviteToken) {
  if (!inviteToken || typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set("invite", inviteToken);

  return url.toString();
}

async function readInviteResponse(response) {
  let result = {};

  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (!response.ok) {
    const error = new Error(result.message ?? "초대 정보를 불러오지 못했어요.");
    error.status = response.status;
    throw error;
  }

  return result.invite;
}

function saveInviteParticipants(invite) {
  const participants = Array.isArray(invite?.participants)
    ? invite.participants
    : [];

  saveDraft({
    togetherParticipants: participants,
    togetherParticipantNames: participants.map((member) => member.nickname),
  });
}

function formatWon(amount) {
  return `${Number(amount).toLocaleString("ko-KR")}원`;
}

function getReceiptSummary(groupId) {
  try {
    const snapshot = window.localStorage.getItem(
      `dutchpay:receipts:${groupId}`,
    );
    const receipts = snapshot ? JSON.parse(snapshot) : [];
    const safeReceipts = Array.isArray(receipts) ? receipts : [];

    return {
      receipts: safeReceipts,
      count: safeReceipts.length,
    };
  } catch {
    return { receipts: [], count: 0 };
  }
}

function formatSavedDate(value) {
  if (!value) {
    return "저장됨";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "저장됨";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function resetPageScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function ModeCards({ selectedMode, onSelect }) {
  return (
    <div className={styles.modeGrid}>
      {MODES.map((mode) => {
        const isSelected = selectedMode === mode.id;

        return (
          <button
            className={`${styles.modeButton} ${
              isSelected ? styles.selectedMode : ""
            }`}
            type="button"
            key={mode.id}
            aria-pressed={isSelected}
            onClick={() => onSelect(mode.id)}
          >
            <span className={styles.modeCheck} aria-hidden="true">
              {isSelected ? "✓" : ""}
            </span>
            <strong>{mode.label}</strong>
            <span>{mode.description}</span>
            <small>{mode.detail}</small>
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ currentStep }) {
  const steps = ["모임 방식", "참여자 설정", "모임 시작"];

  return (
    <ol className={styles.stepper} aria-label="모임 생성 단계">
      {steps.map((label, index) => {
        const step = index + 1;
        const isCurrent = currentStep === step;
        const isCompleted = currentStep > step;

        return (
          <li
            className={
              isCurrent
                ? styles.activeStep
                : isCompleted
                  ? styles.completedStep
                  : ""
            }
            aria-current={isCurrent ? "step" : undefined}
            key={label}
          >
            <span>{isCompleted ? "✓" : step}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function Dashboard({
  captain,
  groups,
  onCreate,
  onOpenGroup,
}) {
  const groupSummaries = groups.map((group) => {
    const receiptSummary = getReceiptSummary(group.id);
    const settlement = calculateGroupSettlement(
      group,
      receiptSummary.receipts,
    );
    const captainBalance =
      settlement.memberTotals.find(
        (memberTotal) => memberTotal.memberId === captain.id,
      )?.balance ?? 0;

    return { group, receiptSummary, captainBalance };
  });
  const activeSummaries = groupSummaries.filter(
    ({ group }) => group.status !== "COMPLETED",
  );
  const sortedGroupSummaries = [...groupSummaries].sort(
    (left, right) =>
      Number(left.group.status === "COMPLETED") -
      Number(right.group.status === "COMPLETED"),
  );
  const receiveAmount = activeSummaries.reduce(
    (total, summary) => total + Math.max(summary.captainBalance, 0),
    0,
  );
  const sendAmount = activeSummaries.reduce(
    (total, summary) => total + Math.max(-summary.captainBalance, 0),
    0,
  );
  return (
    <main className={styles.dashboardMain}>
      <section className={styles.dashboardHero} aria-labelledby="dashboard-title">
        <div>
          <p className={styles.eyebrow}>총대 대시보드</p>
          <h1 id="dashboard-title">{captain.nickname}님의 정산</h1>
          <p>만들었던 모임과 진행 중인 정산을 여기서 다시 열 수 있어요.</p>
        </div>
        <button className={styles.newGroupButton} type="button" onClick={onCreate}>
          + 새 정산 시작
        </button>
      </section>

      <section
        className={styles.balanceSpotlight}
        aria-labelledby="balance-spotlight-title"
      >
        <div className={styles.balanceSpotlightIntro}>
          <span><i aria-hidden="true" /> 진행 중인 정산</span>
          <h2 id="balance-spotlight-title">지금 내 돈 흐름</h2>
          <p>정산 완료 전 모임에서 주고받을 금액을 모두 모았어요.</p>
        </div>
        <dl className={styles.balanceCards}>
          <div className={styles.receiveCard}>
            <dt>내가 받을 돈</dt>
            <dd>{formatWon(receiveAmount)}</dd>
          </div>
          <div className={styles.sendCard}>
            <dt>내가 보낼 돈</dt>
            <dd>{formatWon(sendAmount)}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.dashboardSection} aria-labelledby="saved-title">
        <div className={styles.sectionHeadingRow}>
          <div>
            <p className={styles.eyebrow}>내 정산</p>
            <h2 id="saved-title">정산 목록</h2>
          </div>
        </div>

        {groupSummaries.length > 0 ? (
          <div className={styles.savedGroupList}>
            {sortedGroupSummaries.map(({ group, receiptSummary, captainBalance }) => {
              const isCompleted = group.status === "COMPLETED";
              const balanceLabel =
                captainBalance > 0
                  ? isCompleted
                    ? "받은 돈"
                    : "받을 돈"
                  : captainBalance < 0
                    ? isCompleted
                      ? "보낸 돈"
                      : "보낼 돈"
                    : "정산 없음";

              return (
                <button
                  className={styles.savedGroupCard}
                  type="button"
                  key={group.id}
                  onClick={() => onOpenGroup(group.id)}
                >
                  <span className={styles.groupCardMain}>
                    <span className={styles.groupBadges}>
                      <span className={styles.groupModeBadge}>
                        {group.mode === "TOGETHER" ? "함께하기" : "혼자하기"}
                      </span>
                      <span
                        className={`${styles.groupStatusBadge} ${
                          isCompleted
                            ? styles.completedStatus
                            : styles.activeStatus
                        }`}
                      >
                        {isCompleted ? "정산 완료" : "정산 중"}
                      </span>
                    </span>
                    <strong>{group.name}</strong>
                    <small>
                      {group.members?.length ?? 0}명 · {receiptSummary.count}장 · {formatSavedDate(
                        group.completed_at ??
                          group.activated_at ??
                          group.created_at,
                      )}
                    </small>
                  </span>
                  <span className={styles.groupCardBalance}>
                    <small>{balanceLabel}</small>
                    <strong
                      className={
                        isCompleted
                          ? ""
                          : captainBalance > 0
                          ? styles.receiveText
                          : captainBalance < 0
                            ? styles.sendText
                            : ""
                      }
                    >
                      {formatWon(Math.abs(captainBalance))}
                    </strong>
                  </span>
                  <span className={styles.cardArrow} aria-hidden="true">→</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyDashboard}>
            <span aria-hidden="true">＋</span>
            <strong>아직 저장된 정산이 없어요.</strong>
            <p>새 정산을 시작하면 총대 계정의 목록에 남아요.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function ModeStep({ draft }) {
  const selectedLabel = MODES.find((mode) => mode.id === draft.mode)?.label;

  return (
    <>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>STEP 1</p>
        <h1 id="create-heading">어떻게 정산할까요?</h1>
        <p>이번 모임에 맞는 방식을 하나 선택해 주세요.</p>
      </div>

      <ModeCards
        selectedMode={draft.mode}
        onSelect={(mode) => saveDraft({ mode, completed: false })}
      />

      <div className={styles.selectionStatus} aria-live="polite">
        {selectedLabel ? (
          <>
            <strong>{selectedLabel}</strong> 선택이 이 브라우저에 저장됐어요.
          </>
        ) : (
          "아직 선택한 방식이 없어요."
        )}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={!draft.mode}
          onClick={() => saveDraft({ step: 2 })}
        >
          참여자 설정으로
        </button>
      </div>
    </>
  );
}

function SoloMemberStep({ captain, draft }) {
  const [validationMessage, setValidationMessage] = useState("");

  function updateParticipant(index, value) {
    const nextNames = [...draft.participantNames];
    nextNames[index] = value;
    setValidationMessage("");
    saveDraft({ participantNames: nextNames });
  }

  function addParticipant() {
    setValidationMessage("");
    saveDraft({ participantNames: [...draft.participantNames, ""] });
  }

  function removeParticipant(index) {
    const nextNames = draft.participantNames.filter(
      (_, participantIndex) => participantIndex !== index,
    );

    setValidationMessage("");
    saveDraft({ participantNames: nextNames.length > 0 ? nextNames : [""] });
  }

  function goToConfirmation() {
    const message = getSetupError(draft, captain);

    if (message) {
      setValidationMessage(message);
      return;
    }

    saveDraft({ step: 3 });
  }

  return (
    <>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>STEP 2 · 혼자하기</p>
        <h1 id="create-heading">참여자를 설정해 주세요</h1>
        <p>총대 외에 비용을 나눌 사람의 별명을 입력해요.</p>
      </div>

      <GroupNameField
        value={draft.groupName}
        onChange={(groupName) => {
          setValidationMessage("");
          saveDraft({ groupName });
        }}
      />

      <div className={styles.formSection}>
        <p className={styles.fieldLabel}>총대</p>
        <CaptainRow captain={captain} detail="테스트용 목업 계정 · 모든 비용 결제" />
      </div>

      <div className={styles.formSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.fieldLabel}>추가 참여자</p>
          <button className={styles.addButton} type="button" onClick={addParticipant}>
            + 참여자 추가
          </button>
        </div>

        <div className={styles.participantList}>
          {draft.participantNames.map((name, index) => (
            <div className={styles.participantRow} key={index}>
              <label className={styles.visuallyHidden} htmlFor={`participant-${index}`}>
                참여자 {index + 1} 별명
              </label>
              <input
                className={styles.textInput}
                id={`participant-${index}`}
                type="text"
                value={name}
                placeholder={`참여자 ${index + 1} 별명`}
                maxLength={20}
                onChange={(event) => updateParticipant(index, event.target.value)}
              />
              <button
                className={styles.removeButton}
                type="button"
                aria-label={`참여자 ${index + 1} 삭제`}
                onClick={() => removeParticipant(index)}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>

      {validationMessage && (
        <p className={styles.errorMessage} role="alert">{validationMessage}</p>
      )}

      <div className={styles.actions}>
        <button className={styles.secondaryButton} type="button" onClick={() => saveDraft({ step: 1 })}>
          이전
        </button>
        <button className={styles.primaryButton} type="button" onClick={goToConfirmation}>
          설정 확인
        </button>
      </div>
    </>
  );
}

function GroupNameField({ disabled = false, value, onChange }) {
  return (
    <div className={styles.formSection}>
      <label className={styles.fieldLabel} htmlFor="group-name">모임 이름</label>
      <input
        className={styles.textInput}
        id="group-name"
        type="text"
        value={value}
        placeholder="예: 성수동 토요일 모임"
        maxLength={40}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function CaptainRow({ captain, detail }) {
  return (
    <div className={styles.captainRow}>
      <span className={styles.avatar} aria-hidden="true">{captain.nickname.slice(0, 2)}</span>
      <div>
        <strong>{captain.nickname}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function TogetherMemberStep({ captain, draft }) {
  const [validationMessage, setValidationMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);
  const joinedParticipants =
    draft.togetherParticipants.length > 0
      ? draft.togetherParticipants
      : normalizeNames(draft.togetherParticipantNames).map(
          (nickname, index) => ({
            id: `legacy-${index}`,
            nickname,
            memberType: "guest",
          }),
        );
  const joinedCount = joinedParticipants.length + 1;
  const waitingCount = Math.max(draft.expectedMemberCount - joinedCount, 0);
  const isFull = joinedCount === draft.expectedMemberCount;
  const inviteUrl = getInviteUrl(draft.inviteToken);

  useEffect(() => {
    if (!draft.inviteToken) {
      return undefined;
    }

    let isCancelled = false;

    async function syncParticipants() {
      try {
        const response = await fetch(
          `/api/invites?token=${encodeURIComponent(draft.inviteToken)}`,
          { cache: "no-store" },
        );
        const invite = await readInviteResponse(response);

        if (isCancelled) {
          return;
        }

        const currentParticipants = parseDraft(
          getDraftSnapshot(),
        ).togetherParticipants;

        if (
          JSON.stringify(currentParticipants) !==
          JSON.stringify(invite.participants)
        ) {
          saveInviteParticipants(invite);
        }
      } catch (error) {
        if (!isCancelled && error.status === 404) {
          saveDraft({
            inviteToken: null,
            togetherParticipants: [],
            togetherParticipantNames: [],
          });
          setCopyMessage("초대 링크가 만료되어 새 링크가 필요해요.");
        }
      }
    }

    syncParticipants();
    const intervalId = window.setInterval(syncParticipants, 1000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [draft.inviteToken]);

  function changeExpectedMemberCount(change) {
    if (draft.inviteToken) {
      return;
    }

    const nextCount = Math.min(
      MAX_TOGETHER_MEMBERS,
      Math.max(MIN_TOGETHER_MEMBERS, draft.expectedMemberCount + change),
    );

    setValidationMessage("");
    setCopyMessage("");
    saveDraft({
      expectedMemberCount: nextCount,
      togetherParticipants: draft.togetherParticipants.slice(0, nextCount - 1),
      togetherParticipantNames: draft.togetherParticipantNames.slice(0, nextCount - 1),
    });
  }

  async function issueInvite() {
    if (!draft.groupName.trim()) {
      setValidationMessage("초대 전에 모임 이름을 입력해 주세요.");
      return;
    }

    setIsIssuing(true);
    setValidationMessage("");

    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName: draft.groupName.trim(),
          expectedMemberCount: draft.expectedMemberCount,
          captain: {
            id: captain.id,
            userId: captain.user_id,
            nickname: captain.nickname,
          },
        }),
      });
      const invite = await readInviteResponse(response);

      saveDraft({
        inviteToken: invite.token,
        togetherParticipants: [],
        togetherParticipantNames: [],
      });
      setCopyMessage("초대 링크가 발급됐어요.");
    } catch (error) {
      setValidationMessage(error.message);
    } finally {
      setIsIssuing(false);
    }
  }

  async function copyInviteLink() {
    if (!inviteUrl || !navigator.clipboard) {
      setCopyMessage("주소를 직접 선택해 복사해 주세요.");
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyMessage("초대 링크를 복사했어요.");
    } catch {
      setCopyMessage("주소를 직접 선택해 복사해 주세요.");
    }
  }

  async function removeJoinedParticipant(member) {
    try {
      const response = await fetch("/api/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: draft.inviteToken,
          memberId: member.id,
        }),
      });
      const invite = await readInviteResponse(response);

      saveInviteParticipants(invite);
      setValidationMessage("");
    } catch (error) {
      setValidationMessage(error.message);
    }
  }

  function goToConfirmation() {
    const message = getSetupError(draft, captain);

    if (message) {
      setValidationMessage(message);
      return;
    }

    saveDraft({ step: 3 });
  }

  return (
    <>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>STEP 2 · 함께하기</p>
        <h1 id="create-heading">모두 입장하면 시작해요</h1>
        <p>초대 링크를 보내고 모두 들어오면 모임을 시작할 수 있어요.</p>
      </div>

      <GroupNameField
        disabled={Boolean(draft.inviteToken)}
        value={draft.groupName}
        onChange={(groupName) => {
          setValidationMessage("");
          saveDraft({ groupName });
        }}
      />

      <div className={styles.formSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.fieldLabel}>참여 예정 인원</p>
            <small className={styles.fieldHint}>총대를 포함한 전체 인원이에요.</small>
          </div>
          <div className={styles.countControl} aria-label="참여 예정 인원">
            <button
              type="button"
              aria-label="참여 인원 줄이기"
              disabled={
                Boolean(draft.inviteToken) ||
                draft.expectedMemberCount === MIN_TOGETHER_MEMBERS
              }
              onClick={() => changeExpectedMemberCount(-1)}
            >−</button>
            <strong>{draft.expectedMemberCount}명</strong>
            <button
              type="button"
              aria-label="참여 인원 늘리기"
              disabled={
                Boolean(draft.inviteToken) ||
                draft.expectedMemberCount === MAX_TOGETHER_MEMBERS
              }
              onClick={() => changeExpectedMemberCount(1)}
            >+</button>
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <p className={styles.fieldLabel}>초대 링크</p>
        {draft.inviteToken ? (
          <div className={styles.inviteLinkPanel}>
            <label className={styles.visuallyHidden} htmlFor="invite-link">
              발급된 초대 링크
            </label>
            <input
              className={styles.inviteLinkInput}
              id="invite-link"
              type="text"
              value={inviteUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className={styles.inviteLinkActions}>
              <button
                className={styles.joinButton}
                type="button"
                onClick={copyInviteLink}
              >
                링크 복사
              </button>
              <a href={inviteUrl} target="_blank" rel="noreferrer">
                초대 화면 열기 ↗
              </a>
            </div>
          </div>
        ) : (
          <button
            className={styles.issueInviteButton}
            type="button"
            disabled={isIssuing}
            onClick={issueInvite}
          >
            {isIssuing ? "링크 만드는 중..." : "초대 링크 발급"}
          </button>
        )}
        {copyMessage && (
          <p className={styles.inviteMessage} role="status">{copyMessage}</p>
        )}
      </div>

      <div className={styles.joinStatus}>
        <div className={styles.joinProgressHeading}>
          <strong>현재 참여 상태</strong>
          <span>{joinedCount} / {draft.expectedMemberCount}명 참여 완료</span>
        </div>
        <progress value={joinedCount} max={draft.expectedMemberCount}>
          {joinedCount} / {draft.expectedMemberCount}
        </progress>
        <div className={styles.joinedMemberList}>
          <div className={styles.joinedMemberRow}>
            <span className={`${styles.joinAvatar} ${styles.joinedAvatar}`} aria-hidden="true">
              {captain.nickname.slice(0, 2)}
            </span>
            <span><strong>{captain.nickname}</strong><small>총대</small></span>
            <b>✓ 참여 완료</b>
          </div>
          {joinedParticipants.map((member) => (
            <div className={styles.joinedMemberRow} key={member.id}>
              <span className={styles.joinAvatar} aria-hidden="true">{member.nickname.slice(0, 2)}</span>
              <span>
                <strong>{member.nickname}</strong>
                <small>{member.memberType === "registered" ? "로그인 참여자" : "비회원 참여자"}</small>
              </span>
              <b>✓ 참여 완료</b>
              <button
                className={styles.joinRemoveButton}
                type="button"
                aria-label={`${member.nickname} 참여 취소`}
                onClick={() => removeJoinedParticipant(member)}
              >취소</button>
            </div>
          ))}
          {Array.from({ length: waitingCount }, (_, index) => (
            <div className={`${styles.joinedMemberRow} ${styles.waitingMemberRow}`} key={`waiting-${index}`}>
              <span className={styles.joinAvatar} aria-hidden="true">?</span>
              <span><strong>참여자 {joinedCount + index + 1}</strong><small>초대 대기</small></span>
              <b>기다리는 중</b>
            </div>
          ))}
        </div>
      </div>

      {validationMessage && (
        <p className={styles.errorMessage} role="alert">{validationMessage}</p>
      )}

      <div className={styles.actions}>
        <button className={styles.secondaryButton} type="button" onClick={() => saveDraft({ step: 1 })}>
          이전
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={!isFull}
          onClick={goToConfirmation}
        >
          {isFull ? "설정 확인" : `${waitingCount}명 더 필요해요`}
        </button>
      </div>
    </>
  );
}

function InviteJoinScreen({ inviteToken }) {
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

    return () => {
      isCancelled = true;
    };
  }, [inviteToken]);

  function leaveInvite() {
    window.location.assign(window.location.pathname);
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
          몫대로
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
              {invite.currentMember.id === invite.captain.id && (
                <button className={styles.secondaryButton} type="button" onClick={leaveInvite}>
                  내 정산으로 돌아가기
                </button>
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

function ConfirmationStep({ captain, draft, onCreate }) {
  const participantNames = getDraftParticipantNames(draft);
  const allNames = [captain.nickname, ...participantNames];
  const modeLabel = draft.mode === "TOGETHER" ? "함께하기" : "혼자하기";

  return (
    <>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>STEP 3</p>
        <h1 id="create-heading">이대로 모임을 만들까요?</h1>
        <p>입력한 모임과 참여자를 한 번 확인해 주세요.</p>
      </div>

      <dl className={styles.summary}>
        <div><dt>모임 방식</dt><dd>{modeLabel}</dd></div>
        <div><dt>모임 이름</dt><dd>{draft.groupName.trim()}</dd></div>
        <div><dt>참여 인원</dt><dd>{allNames.length}명</dd></div>
        {draft.mode === "TOGETHER" && (
          <div><dt>참여 상태</dt><dd>{allNames.length} / {draft.expectedMemberCount}명 참여 완료</dd></div>
        )}
      </dl>

      <div className={styles.memberSummary}>
        <p className={styles.fieldLabel}>참여자</p>
        <div className={styles.memberChips}>
          {allNames.map((name, index) => (
            <span key={`${name}-${index}`}>{name}{index === 0 ? " · 총대" : ""}</span>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.secondaryButton} type="button" onClick={() => saveDraft({ step: 2 })}>
          이전
        </button>
        <button className={styles.primaryButton} type="button" onClick={onCreate}>
          모임 만들기
        </button>
      </div>
    </>
  );
}

export default function ModeSelector({ captain, inviteToken = "" }) {
  const [screen, setScreen] = useState("dashboard");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
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
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);

  if (inviteToken) {
    return (
      <InviteJoinScreen inviteToken={inviteToken} />
    );
  }

  function showDashboard() {
    setScreen("dashboard");
    setSelectedGroupId(null);
    resetPageScroll();
  }

  function startNewGroup() {
    setScreen("create");
    setSelectedGroupId(null);
    resetPageScroll();
    replaceDraft({
      ...EMPTY_DRAFT,
      participantNames: [""],
      togetherParticipantNames: [],
      togetherParticipants: [],
    });
  }

  function openGroup(groupId) {
    setSelectedGroupId(groupId);
    setScreen("group");
    resetPageScroll();
  }

  function completeGroup(groupId) {
    const group = groups.find((currentGroup) => currentGroup.id === groupId);

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
    setSelectedGroupId(group.id);
    setScreen("group");
    resetPageScroll();
  }

  return (
    <div className={styles.pageShell}>
      <header className={styles.header}>
        <button className={styles.brand} type="button" onClick={showDashboard}>
          몫대로
        </button>
        <div className={styles.captain}>
          <span className={styles.captainLabel}>테스트 총대</span>
          <strong>{captain.nickname}</strong>
        </div>
      </header>

      {screen === "group" && selectedGroup ? (
        <GroupBoard
          group={selectedGroup}
          currentMemberId={captain.id}
          onBack={showDashboard}
          onComplete={() => completeGroup(selectedGroup.id)}
        />
      ) : screen === "create" ? (
        <main className={styles.main}>
          <div className={styles.creationNavigation}>
            <button type="button" onClick={showDashboard}>← 대시보드</button>
            <span>작성 내용은 이 브라우저에 자동 저장돼요.</span>
          </div>
          <Stepper currentStep={draft.step} />

          <section className={styles.card} aria-labelledby="create-heading">
            {draft.step === 1 ? (
              <ModeStep draft={draft} />
            ) : draft.step === 2 && draft.mode === "TOGETHER" ? (
              <TogetherMemberStep captain={captain} draft={draft} />
            ) : draft.step === 2 ? (
              <SoloMemberStep captain={captain} draft={draft} />
            ) : (
              <ConfirmationStep captain={captain} draft={draft} onCreate={createGroup} />
            )}
          </section>
        </main>
      ) : (
        <Dashboard
          captain={captain}
          groups={groups}
          onCreate={startNewGroup}
          onOpenGroup={openGroup}
        />
      )}
    </div>
  );
}
