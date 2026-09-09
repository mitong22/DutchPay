"use client";

import { useState, useSyncExternalStore } from "react";

import GroupBoard from "./groupBoard";
import styles from "./modeSelector.module.css";

const LEGACY_MODE_KEY = "dutchpay:group-draft:mode";
const DRAFT_KEY = "dutchpay:group-create-draft";
const ACTIVE_GROUP_KEY = "dutchpay:active-group";
const STORE_CHANGE_EVENT = "dutchpay-demo-store-change";
const VALID_MODES = new Set(["SOLO", "TOGETHER"]);

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
    detail: "초대와 공동 사용은 이후 단계에서 연결할 예정이에요.",
  },
];

const EMPTY_DRAFT = {
  step: 1,
  mode: null,
  groupName: "",
  participantNames: [""],
  completed: false,
};

const EMPTY_DRAFT_SNAPSHOT = JSON.stringify(EMPTY_DRAFT);
const SOLO_DRAFT_SNAPSHOT = JSON.stringify({ ...EMPTY_DRAFT, mode: "SOLO" });
const TOGETHER_DRAFT_SNAPSHOT = JSON.stringify({
  ...EMPTY_DRAFT,
  mode: "TOGETHER",
});

function parseDraft(snapshot) {
  try {
    const draft = JSON.parse(snapshot);

    return {
      ...EMPTY_DRAFT,
      ...draft,
      step: [1, 2, 3].includes(draft.step) ? draft.step : 1,
      mode: VALID_MODES.has(draft.mode) ? draft.mode : null,
      participantNames:
        Array.isArray(draft.participantNames) &&
        draft.participantNames.length > 0
          ? draft.participantNames
          : [""],
    };
  } catch {
    return EMPTY_DRAFT;
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

function getActiveGroupSnapshot() {
  try {
    return window.localStorage.getItem(ACTIVE_GROUP_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerActiveGroupSnapshot() {
  return "";
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

function saveDraft(patch) {
  const currentDraft = parseDraft(getDraftSnapshot());
  const nextDraft = { ...currentDraft, ...patch };

  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));

  if (nextDraft.mode) {
    window.localStorage.setItem(LEGACY_MODE_KEY, nextDraft.mode);
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

function getSetupError(draft, captain) {
  if (!draft.groupName.trim()) {
    return "모임 이름을 입력해 주세요.";
  }

  const participantNames = normalizeNames(draft.participantNames);
  const comparableNames = participantNames.map((name) => name.toLowerCase());

  if (new Set(comparableNames).size !== comparableNames.length) {
    return "참여자 별명은 서로 다르게 입력해 주세요.";
  }

  if (
    comparableNames.includes(captain.nickname.trim().toLowerCase())
  ) {
    return "목업 총대와 다른 참여자 별명을 입력해 주세요.";
  }

  return "";
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

function ModeStep({ draft }) {
  const selectedLabel = MODES.find(
    (mode) => mode.id === draft.mode,
  )?.label;
  const togetherSelected = draft.mode === "TOGETHER";

  return (
    <>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>STEP 1</p>
        <h1 id="create-heading">어떻게 정산할까요?</h1>
        <p>이번 모임에 맞는 방식을 하나 선택해 주세요.</p>
      </div>

      <ModeCards
        selectedMode={draft.mode}
        onSelect={(mode) =>
          saveDraft({ mode, completed: false })
        }
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

      {togetherSelected && (
        <p className={styles.infoMessage}>
          함께하기 참여자 초대는 SOLO 흐름을 확인한 뒤 구현합니다.
        </p>
      )}

      <div className={styles.actions}>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={draft.mode !== "SOLO"}
          onClick={() => saveDraft({ step: 2 })}
        >
          참여자 설정으로
        </button>
      </div>
    </>
  );
}

function MemberStep({ captain, draft }) {
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
    saveDraft({
      participantNames: nextNames.length > 0 ? nextNames : [""],
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
        <p className={styles.eyebrow}>STEP 2</p>
        <h1 id="create-heading">참여자를 설정해 주세요</h1>
        <p>총대 외에 비용을 나눌 사람의 별명을 입력해요.</p>
      </div>

      <div className={styles.formSection}>
        <label className={styles.fieldLabel} htmlFor="group-name">
          모임 이름
        </label>
        <input
          className={styles.textInput}
          id="group-name"
          type="text"
          value={draft.groupName}
          placeholder="예: 성수동 토요일 모임"
          maxLength={40}
          onChange={(event) => {
            setValidationMessage("");
            saveDraft({ groupName: event.target.value });
          }}
        />
      </div>

      <div className={styles.formSection}>
        <p className={styles.fieldLabel}>총대</p>
        <div className={styles.captainRow}>
          <span className={styles.avatar} aria-hidden="true">
            {captain.nickname.slice(0, 1)}
          </span>
          <div>
            <strong>{captain.nickname}</strong>
            <small>테스트용 목업 계정 · 모든 비용 결제</small>
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.fieldLabel}>추가 참여자</p>
          <button
            className={styles.addButton}
            type="button"
            onClick={addParticipant}
          >
            + 참여자 추가
          </button>
        </div>

        <div className={styles.participantList}>
          {draft.participantNames.map((name, index) => (
            <div className={styles.participantRow} key={index}>
              <label
                className={styles.visuallyHidden}
                htmlFor={`participant-${index}`}
              >
                참여자 {index + 1} 별명
              </label>
              <input
                className={styles.textInput}
                id={`participant-${index}`}
                type="text"
                value={name}
                placeholder={`참여자 ${index + 1} 별명`}
                maxLength={20}
                onChange={(event) =>
                  updateParticipant(index, event.target.value)
                }
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
        <p className={styles.errorMessage} role="alert">
          {validationMessage}
        </p>
      )}

      <div className={styles.actions}>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => saveDraft({ step: 1 })}
        >
          이전
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={goToConfirmation}
        >
          설정 확인
        </button>
      </div>
    </>
  );
}

function ConfirmationStep({ captain, draft, onCreate }) {
  const participantNames = normalizeNames(draft.participantNames);
  const allNames = [captain.nickname, ...participantNames];

  return (
    <>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>STEP 3</p>
        <h1 id="create-heading">이대로 모임을 만들까요?</h1>
        <p>입력한 모임과 참여자를 한 번 확인해 주세요.</p>
      </div>

      <dl className={styles.summary}>
        <div>
          <dt>모임 방식</dt>
          <dd>혼자하기</dd>
        </div>
        <div>
          <dt>모임 이름</dt>
          <dd>{draft.groupName.trim()}</dd>
        </div>
        <div>
          <dt>참여 인원</dt>
          <dd>{allNames.length}명</dd>
        </div>
      </dl>

      <div className={styles.memberSummary}>
        <p className={styles.fieldLabel}>참여자</p>
        <div className={styles.memberChips}>
          {allNames.map((name, index) => (
            <span key={`${name}-${index}`}>
              {name}
              {index === 0 ? " · 총대" : ""}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => saveDraft({ step: 2 })}
        >
          이전
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={onCreate}
        >
          모임 만들기
        </button>
      </div>
    </>
  );
}

export default function ModeSelector({ captain }) {
  const draftSnapshot = useSyncExternalStore(
    subscribeToDemoStore,
    getDraftSnapshot,
    getServerDraftSnapshot,
  );
  const activeGroupSnapshot = useSyncExternalStore(
    subscribeToDemoStore,
    getActiveGroupSnapshot,
    getServerActiveGroupSnapshot,
  );

  const draft = parseDraft(draftSnapshot);
  const activeGroup = activeGroupSnapshot
    ? JSON.parse(activeGroupSnapshot)
    : null;
  const showCompleted = draft.completed && activeGroup;

  function createGroup() {
    const message = getSetupError(draft, captain);

    if (message) {
      saveDraft({ step: 2 });
      return;
    }

    const now = new Date().toISOString();
    const participantNames = normalizeNames(draft.participantNames);
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
      mode: "SOLO",
      status: "ACTIVE",
      expected_member_count: members.length,
      activated_at: now,
      calculation_version: 1,
      members,
    };

    window.localStorage.setItem(ACTIVE_GROUP_KEY, JSON.stringify(group));
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, step: 3, completed: true }),
    );
    notifyStoreChange();
  }

  return (
    <div className={styles.pageShell}>
      <header className={styles.header}>
        <span className={styles.brand}>몫대로</span>
        <div className={styles.captain}>
          <span className={styles.captainLabel}>테스트 총대</span>
          <strong>{captain.nickname}</strong>
        </div>
      </header>

      {showCompleted ? (
        <GroupBoard group={activeGroup} currentMemberId={captain.id} />
      ) : (
        <main className={styles.main}>
          <Stepper currentStep={draft.step} />

          <section className={styles.card} aria-labelledby="create-heading">
            {draft.step === 1 ? (
              <ModeStep draft={draft} />
            ) : draft.step === 2 ? (
              <MemberStep captain={captain} draft={draft} />
            ) : (
              <ConfirmationStep
                captain={captain}
                draft={draft}
                onCreate={createGroup}
              />
            )}
          </section>
        </main>
      )}
    </div>
  );
}
