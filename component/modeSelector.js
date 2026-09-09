"use client";

import { useState, useSyncExternalStore } from "react";

import GroupBoard from "./groupBoard";
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
    detail: "테스트 참여자를 입장시켜 여러 결제자를 확인할 수 있어요.",
  },
];

const EMPTY_DRAFT = {
  step: 1,
  mode: null,
  groupName: "",
  participantNames: [""],
  expectedMemberCount: 3,
  togetherParticipantNames: [],
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
      ? draft.togetherParticipantNames
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

  if (
    draft.mode === "TOGETHER" &&
    participantNames.length !== draft.expectedMemberCount - 1
  ) {
    return "예정된 참여자가 모두 입장해야 모임을 시작할 수 있어요.";
  }

  return "";
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
      count: safeReceipts.length,
      total: safeReceipts.reduce((total, receipt) => {
        const amount = Number(receipt.total_amount);
        return total + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    };
  } catch {
    return { count: 0, total: 0 };
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
  draft,
  groups,
  onContinueDraft,
  onCreate,
  onOpenGroup,
}) {
  const groupSummaries = groups.map((group) => ({
    group,
    receiptSummary: getReceiptSummary(group.id),
  }));
  const totalReceiptCount = groupSummaries.reduce(
    (total, summary) => total + summary.receiptSummary.count,
    0,
  );
  const totalAmount = groupSummaries.reduce(
    (total, summary) => total + summary.receiptSummary.total,
    0,
  );
  const hasDraft =
    !draft.completed &&
    Boolean(draft.mode || draft.groupName.trim() || draft.step > 1);
  const draftModeLabel = MODES.find((mode) => mode.id === draft.mode)?.label;

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

      <dl className={styles.dashboardStats}>
        <div>
          <dt>저장된 모임</dt>
          <dd>{groups.length}개</dd>
        </div>
        <div>
          <dt>등록 영수증</dt>
          <dd>{totalReceiptCount}장</dd>
        </div>
        <div>
          <dt>전체 기록 금액</dt>
          <dd>{formatWon(totalAmount)}</dd>
        </div>
      </dl>

      {hasDraft && (
        <section className={styles.dashboardSection} aria-labelledby="draft-title">
          <div className={styles.sectionHeadingRow}>
            <div>
              <p className={styles.eyebrow}>작성 중</p>
              <h2 id="draft-title">멈춘 곳에서 이어서 만들기</h2>
            </div>
          </div>
          <button className={styles.draftCard} type="button" onClick={onContinueDraft}>
            <span className={styles.draftStep}>STEP {draft.step} / 3</span>
            <span className={styles.draftContent}>
              <strong>{draft.groupName.trim() || "이름 없는 새 모임"}</strong>
              <small>{draftModeLabel ?? "방식 선택 전"} · 자동 저장됨</small>
            </span>
            <span className={styles.cardArrow} aria-hidden="true">→</span>
          </button>
        </section>
      )}

      <section className={styles.dashboardSection} aria-labelledby="saved-title">
        <div className={styles.sectionHeadingRow}>
          <div>
            <p className={styles.eyebrow}>내 정산</p>
            <h2 id="saved-title">저장된 모임</h2>
          </div>
          <span>{groups.length}개</span>
        </div>

        {groupSummaries.length > 0 ? (
          <div className={styles.savedGroupList}>
            {groupSummaries.map(({ group, receiptSummary }) => (
              <button
                className={styles.savedGroupCard}
                type="button"
                key={group.id}
                onClick={() => onOpenGroup(group.id)}
              >
                <span className={styles.groupCardMain}>
                  <span className={styles.groupModeBadge}>
                    {group.mode === "TOGETHER" ? "함께하기" : "혼자하기"}
                  </span>
                  <strong>{group.name}</strong>
                  <small>
                    {group.members?.length ?? 0}명 · {receiptSummary.count}장 · {formatSavedDate(group.activated_at ?? group.created_at)}
                  </small>
                </span>
                <span className={styles.groupCardTotal}>
                  <small>등록 금액</small>
                  <strong>{formatWon(receiptSummary.total)}</strong>
                </span>
                <span className={styles.cardArrow} aria-hidden="true">→</span>
              </button>
            ))}
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

function GroupNameField({ value, onChange }) {
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
  const [inviteeName, setInviteeName] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const joinedNames = normalizeNames(draft.togetherParticipantNames);
  const joinedCount = joinedNames.length + 1;
  const waitingCount = Math.max(draft.expectedMemberCount - joinedCount, 0);
  const isFull = joinedCount === draft.expectedMemberCount;

  function changeExpectedMemberCount(change) {
    const nextCount = Math.min(
      MAX_TOGETHER_MEMBERS,
      Math.max(MIN_TOGETHER_MEMBERS, draft.expectedMemberCount + change),
    );

    setValidationMessage("");
    saveDraft({
      expectedMemberCount: nextCount,
      togetherParticipantNames: draft.togetherParticipantNames.slice(0, nextCount - 1),
    });
  }

  function joinParticipant(event) {
    event.preventDefault();
    const name = inviteeName.trim();
    const comparableName = name.toLowerCase();
    const existingNames = [captain.nickname, ...joinedNames].map((item) =>
      item.trim().toLowerCase(),
    );

    if (!name) {
      setValidationMessage("입장할 참여자의 별명을 입력해 주세요.");
      return;
    }

    if (isFull) {
      setValidationMessage("예정된 인원이 모두 입장했어요.");
      return;
    }

    if (existingNames.includes(comparableName)) {
      setValidationMessage("이미 사용 중인 별명이에요.");
      return;
    }

    saveDraft({
      togetherParticipantNames: [...draft.togetherParticipantNames, name],
    });
    setInviteeName("");
    setValidationMessage("");
  }

  function removeJoinedParticipant(index) {
    setValidationMessage("");
    saveDraft({
      togetherParticipantNames: draft.togetherParticipantNames.filter(
        (_, participantIndex) => participantIndex !== index,
      ),
    });
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
        <p>로그인 대신 테스트 참여자를 직접 입장시켜 흐름을 확인해요.</p>
      </div>

      <GroupNameField
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
              disabled={draft.expectedMemberCount === MIN_TOGETHER_MEMBERS}
              onClick={() => changeExpectedMemberCount(-1)}
            >−</button>
            <strong>{draft.expectedMemberCount}명</strong>
            <button
              type="button"
              aria-label="참여 인원 늘리기"
              disabled={draft.expectedMemberCount === MAX_TOGETHER_MEMBERS}
              onClick={() => changeExpectedMemberCount(1)}
            >+</button>
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <p className={styles.fieldLabel}>테스트 참여자 입장</p>
        <form className={styles.mockJoinForm} onSubmit={joinParticipant}>
          <label className={styles.visuallyHidden} htmlFor="mock-invitee-name">
            입장할 참여자 별명
          </label>
          <input
            className={styles.textInput}
            id="mock-invitee-name"
            type="text"
            value={inviteeName}
            maxLength={20}
            disabled={isFull}
            placeholder={isFull ? "모두 입장했어요" : "참여자 별명"}
            onChange={(event) => {
              setInviteeName(event.target.value);
              setValidationMessage("");
            }}
          />
          <button className={styles.joinButton} type="submit" disabled={isFull}>
            입장시키기
          </button>
        </form>
        <p className={styles.mockInviteNote}>
          실제 초대 링크와 카카오톡 연결은 로그인 기능을 붙일 때 연결해요.
        </p>
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
          {joinedNames.map((name, index) => (
            <div className={styles.joinedMemberRow} key={`${name}-${index}`}>
              <span className={styles.joinAvatar} aria-hidden="true">{name.slice(0, 2)}</span>
              <span><strong>{name}</strong><small>테스트 참여자</small></span>
              <b>✓ 참여 완료</b>
              <button
                className={styles.joinRemoveButton}
                type="button"
                aria-label={`${name} 참여 취소`}
                onClick={() => removeJoinedParticipant(index)}
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

export default function ModeSelector({ captain }) {
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
    });
  }

  function openGroup(groupId) {
    setSelectedGroupId(groupId);
    setScreen("group");
    resetPageScroll();
  }

  function continueDraft() {
    setScreen("create");
    resetPageScroll();
  }

  function createGroup() {
    const message = getSetupError(draft, captain);

    if (message) {
      saveDraft({ step: 2 });
      return;
    }

    const now = new Date().toISOString();
    const participantNames = getDraftParticipantNames(draft);
    const members = [
      {
        id: captain.id,
        user_id: captain.user_id,
        nickname: captain.nickname,
        member_type: captain.member_type,
      },
      ...participantNames.map((nickname) => ({
        id: createId("mock-member"),
        user_id: null,
        nickname,
        member_type: "guest",
      })),
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
        <GroupBoard group={selectedGroup} currentMemberId={captain.id} onBack={showDashboard} />
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
          draft={draft}
          groups={groups}
          onContinueDraft={continueDraft}
          onCreate={startNewGroup}
          onOpenGroup={openGroup}
        />
      )}
    </div>
  );
}
