"use client";

import { useActionState } from "react";

import { signInAction } from "@/app/actions";

const INITIAL_STATE = { message: "" };

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    signInAction,
    INITIAL_STATE,
  );

  return (
    <form className="login-card" action={formAction}>
      <div className="login-card__heading">
        <span className="eyebrow">로그인</span>
        <h2>내 정산 이어가기</h2>
        <p>가입된 이메일 계정으로 로그인해 주세요.</p>
      </div>

      <label className="field">
        <span>이메일</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
        />
      </label>
      <label className="field">
        <span>비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
          required
        />
      </label>

      {state.message ? (
        <p className="form-message form-message--error" role="alert">
          {state.message}
        </p>
      ) : null}

      <button className="button button--primary button--wide" disabled={isPending}>
        {isPending ? "로그인 중..." : "로그인"}
      </button>
      <p className="login-card__help">
        개발용 계정은 프로젝트의 seed 데이터에 정의되어 있습니다.
      </p>
    </form>
  );
}
