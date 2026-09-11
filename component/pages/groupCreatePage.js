"use client";

import { useEffect, useState } from "react";

import styles from "../app.module.css";
import {
  MAX_TOGETHER_MEMBERS,
  MIN_TOGETHER_MEMBERS,
  MODES,
  getDraftParticipantNames,
  getDraftSnapshot,
  getInviteUrl,
  getSetupError,
  normalizeNames,
  parseDraft,
  readInviteResponse,
  saveDraft,
  saveInviteParticipants,
} from "@/lib/groupDraftStore";

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
        <CaptainRow captain={captain} detail="로그인 계정 · 모든 비용 결제" />
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

function ConfirmationStep({ captain, draft, onCreate }) {
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const participantNames = getDraftParticipantNames(draft);
  const allNames = [captain.nickname, ...participantNames];
  const modeLabel = draft.mode === "TOGETHER" ? "함께하기" : "혼자하기";

  async function createGroup() {
    setIsCreating(true);
    setCreateError("");

    try {
      await onCreate();
    } catch (error) {
      setCreateError(error.message);
      setIsCreating(false);
    }
  }

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
        <button
          className={styles.primaryButton}
          type="button"
          disabled={isCreating}
          onClick={createGroup}
        >
          {isCreating ? "모임 만드는 중..." : "모임 만들기"}
        </button>
      </div>
      {createError && (
        <p className={styles.errorMessage} role="alert">{createError}</p>
      )}
    </>
  );
}


export default function GroupCreatePage({ captain, draft, onBack, onCreate }) {
  return (
    <main className={styles.main}>
      <div className={styles.creationNavigation}>
        <button type="button" onClick={onBack}>← 대시보드</button>
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
          <ConfirmationStep captain={captain} draft={draft} onCreate={onCreate} />
        )}
      </section>
    </main>
  );
}
