"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createGroupAction } from "@/app/group-actions";

const INITIAL_STATE = { status: "idle" };

function StepIndicator({ currentStep }) {
  return (
    <ol className="step-indicator" aria-label="모임 만들기 진행 단계">
      {["방식", "참여자", "확인"].map((label, index) => {
        const step = index + 1;
        return (
          <li className={step <= currentStep ? "is-active" : ""} key={label}>
            <span>{step}</span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function InviteResult({ state }) {
  const [copiedPath, setCopiedPath] = useState("");

  async function copyInvitePath(path) {
    const inviteUrl = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedPath(path);
  }

  return (
    <div className="creation-result">
      <span className="creation-result__icon" aria-hidden="true">
        ✓
      </span>
      <h3>모임을 만들었습니다.</h3>
      <p>
        {state.mode === "TOGETHER"
          ? "각 초대 링크는 한 명만 사용할 수 있으며 7일 동안 유효합니다. 지금 안전한 곳에 복사해 두세요."
          : "영수증을 등록하고 메뉴별 참여자를 선택해 보세요."}
      </p>

      {state.invitePaths.length > 0 ? (
        <div className="invite-result-list">
          {state.invitePaths.map((path, index) => (
            <div className="invite-result-row" key={path}>
              <span>참여자 {index + 1}</span>
              <code>{path}</code>
              <button
                className="button button--small button--secondary"
                type="button"
                onClick={() => copyInvitePath(path)}
              >
                {copiedPath === path ? "복사됨" : "링크 복사"}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Link className="button button--primary" href={`/groups/${state.groupId}`}>
        모임으로 이동
      </Link>
    </div>
  );
}

export default function GroupSetup({ userName }) {
  const [state, formAction, isPending] = useActionState(
    createGroupAction,
    INITIAL_STATE,
  );
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [ownerNickname, setOwnerNickname] = useState(userName);
  const [soloMembers, setSoloMembers] = useState([""]);
  const [togetherMemberCount, setTogetherMemberCount] = useState(2);

  if (state.status === "success") {
    return <InviteResult state={state} />;
  }

  function updateSoloMember(index, value) {
    setSoloMembers(
      soloMembers.map((nickname, memberIndex) =>
        memberIndex === index ? value : nickname,
      ),
    );
  }

  function removeSoloMember(index) {
    setSoloMembers(
      soloMembers.filter((nickname, memberIndex) => memberIndex !== index),
    );
  }

  return (
    <div className="setup-card">
      <StepIndicator currentStep={step} />

      {step === 1 ? (
        <div className="setup-panel">
          <div className="setup-panel__heading">
            <span>1단계</span>
            <h3>어떻게 정산할까요?</h3>
          </div>
          <div className="mode-grid">
            <button
              className={`mode-card ${mode === "SOLO" ? "is-selected" : ""}`}
              type="button"
              onClick={() => setMode("SOLO")}
            >
              <span className="mode-card__icon" aria-hidden="true">
                ✍️
              </span>
              <strong>혼자하기</strong>
              <p>한 사람이 모든 영수증과 참여자를 직접 입력합니다.</p>
            </button>
            <button
              className={`mode-card ${mode === "TOGETHER" ? "is-selected" : ""}`}
              type="button"
              onClick={() => setMode("TOGETHER")}
            >
              <span className="mode-card__icon" aria-hidden="true">
                👥
              </span>
              <strong>함께하기</strong>
              <p>초대받은 사람이 들어와 각자 영수증을 등록합니다.</p>
            </button>
          </div>
          <div className="setup-actions setup-actions--end">
            <button
              className="button button--primary"
              type="button"
              disabled={!mode}
              onClick={() => setStep(2)}
            >
              다음
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="setup-panel">
          <div className="setup-panel__heading">
            <span>2단계</span>
            <h3>모임과 참여자를 알려 주세요.</h3>
          </div>
          <div className="form-grid">
            <label className="field field--wide">
              <span>모임 이름</span>
              <input
                value={groupName}
                maxLength={60}
                placeholder="예: 9월 부산 여행"
                onChange={(event) => setGroupName(event.target.value)}
              />
            </label>
            <label className="field">
              <span>내 별명</span>
              <input
                value={ownerNickname}
                maxLength={30}
                placeholder="모임에서 사용할 이름"
                onChange={(event) => setOwnerNickname(event.target.value)}
              />
            </label>

            {mode === "SOLO" ? (
              <div className="field field--wide">
                <span>함께 정산할 사람</span>
                <div className="member-input-list">
                  {soloMembers.map((nickname, index) => (
                    <div className="member-input-row" key={`member-${index}`}>
                      <input
                        value={nickname}
                        maxLength={30}
                        aria-label={`참여자 ${index + 1} 별명`}
                        placeholder={`참여자 ${index + 1} 별명`}
                        onChange={(event) =>
                          updateSoloMember(index, event.target.value)
                        }
                      />
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`참여자 ${index + 1} 삭제`}
                        disabled={soloMembers.length === 1}
                        onClick={() => removeSoloMember(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="text-button"
                  type="button"
                  disabled={soloMembers.length >= 49}
                  onClick={() => setSoloMembers([...soloMembers, ""])}
                >
                  + 참여자 추가
                </button>
              </div>
            ) : (
              <label className="field">
                <span>총 참여 인원</span>
                <input
                  value={togetherMemberCount}
                  min={2}
                  max={50}
                  type="number"
                  onChange={(event) =>
                    setTogetherMemberCount(Number(event.target.value))
                  }
                />
                <small>나를 포함한 인원입니다.</small>
              </label>
            )}
          </div>
          <div className="setup-actions">
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setStep(1)}
            >
              이전
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={!groupName.trim() || !ownerNickname.trim()}
              onClick={() => setStep(3)}
            >
              다음
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <form className="setup-panel" action={formAction}>
          <input name="mode" type="hidden" value={mode} />
          <input name="groupName" type="hidden" value={groupName} />
          <input name="ownerNickname" type="hidden" value={ownerNickname} />
          <input
            name="togetherMemberCount"
            type="hidden"
            value={togetherMemberCount}
          />
          {soloMembers.map((nickname, index) => (
            <input
              name="soloMemberNickname"
              type="hidden"
              value={nickname}
              key={`hidden-member-${index}`}
            />
          ))}

          <div className="setup-panel__heading">
            <span>3단계</span>
            <h3>이 내용으로 시작할까요?</h3>
          </div>
          <dl className="review-list">
            <div>
              <dt>방식</dt>
              <dd>{mode === "SOLO" ? "혼자하기" : "함께하기"}</dd>
            </div>
            <div>
              <dt>모임</dt>
              <dd>{groupName}</dd>
            </div>
            <div>
              <dt>내 별명</dt>
              <dd>{ownerNickname}</dd>
            </div>
            <div>
              <dt>총 인원</dt>
              <dd>
                {mode === "SOLO"
                  ? soloMembers.filter((nickname) => nickname.trim()).length + 1
                  : togetherMemberCount}
                명
              </dd>
            </div>
          </dl>

          {state.status === "error" ? (
            <p className="form-message form-message--error" role="alert">
              {state.message}
            </p>
          ) : null}

          <div className="setup-actions">
            <button
              className="button button--quiet"
              type="button"
              disabled={isPending}
              onClick={() => setStep(2)}
            >
              이전
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={isPending}
            >
              {isPending ? "만드는 중..." : "모임 만들기"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
