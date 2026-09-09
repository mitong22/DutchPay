"use client";

import { useActionState, useState } from "react";

import { regenerateInviteAction } from "@/app/groups/[groupId]/actions";

const INITIAL_STATE = { status: "idle" };

export default function InviteSlot({ groupId, inviteId, slotNumber, expiresAt }) {
  const action = regenerateInviteAction.bind(null, groupId, inviteId);
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [isCopied, setIsCopied] = useState(false);

  async function copyInvite() {
    await navigator.clipboard.writeText(
      `${window.location.origin}${state.invitePath}`,
    );
    setIsCopied(true);
  }

  return (
    <div className="invite-slot">
      <div>
        <strong>초대 자리 {slotNumber}</strong>
        <span>기존 링크 만료: {expiresAt}</span>
      </div>

      {state.status === "success" ? (
        <div className="invite-slot__result">
          <code>{state.invitePath}</code>
          <button
            className="button button--small button--secondary"
            type="button"
            onClick={copyInvite}
          >
            {isCopied ? "복사됨" : "새 링크 복사"}
          </button>
        </div>
      ) : (
        <form action={formAction}>
          <button
            className="button button--small button--quiet"
            type="submit"
            disabled={isPending}
          >
            {isPending ? "재발급 중..." : "링크 재발급"}
          </button>
        </form>
      )}

      {state.status === "error" ? (
        <p className="form-message form-message--error" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
