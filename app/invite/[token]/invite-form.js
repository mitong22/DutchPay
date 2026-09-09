"use client";

import { useActionState } from "react";

import { claimInviteAction } from "@/app/invite/[token]/actions";

const INITIAL_STATE = { status: "idle", message: "" };

export default function InviteForm({ token, member }) {
  const action = claimInviteAction.bind(null, token);
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form className="invite-form" action={formAction}>
      {member ? (
        <div className="returning-member">
          <span>기존 참여자</span>
          <strong>{member.nickname}</strong>
          <p>같은 참여자 정보로 새 7일 세션을 발급합니다.</p>
        </div>
      ) : (
        <label className="field">
          <span>모임에서 사용할 별명</span>
          <input
            name="nickname"
            type="text"
            maxLength={30}
            autoComplete="nickname"
            placeholder="예: 지현"
            required
          />
          <small>별명은 이 모임의 다른 참여자와 달라야 합니다.</small>
        </label>
      )}

      {state.status === "error" ? (
        <p className="form-message form-message--error" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        className="button button--primary button--wide"
        type="submit"
        disabled={isPending}
      >
        {isPending
          ? "입장 준비 중..."
          : member
            ? "다시 입장하기"
            : "이 별명으로 참여하기"}
      </button>
    </form>
  );
}
