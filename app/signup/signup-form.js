"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUpAction } from "@/app/actions";

const INITIAL_STATE = { message: "" };

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    INITIAL_STATE,
  );

  return (
    <form className="login-card signup-card" action={formAction}>
      <div className="login-card__heading">
        <span className="eyebrow">회원가입</span>
        <h2>내 정산 계정 만들기</h2>
        <p>모임을 만들고 관리할 이메일 계정을 만들어 주세요.</p>
      </div>

      <label className="field">
        <span>이름</span>
        <input
          name="name"
          type="text"
          autoComplete="name"
          maxLength={30}
          placeholder="이름을 입력하세요"
          required
        />
      </label>
      <label className="field">
        <span>이메일</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          placeholder="name@example.com"
          required
        />
      </label>
      <label className="field">
        <span>비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          placeholder="8자 이상 입력하세요"
          required
        />
        <small>8자 이상 128자 이하로 입력해 주세요.</small>
      </label>
      <label className="field">
        <span>비밀번호 확인</span>
        <input
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          placeholder="비밀번호를 다시 입력하세요"
          required
        />
      </label>

      {state.message ? (
        <p className="form-message form-message--error" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        className="button button--primary button--wide"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "가입 중..." : "회원가입"}
      </button>
      <p className="login-card__help">
        이미 계정이 있으신가요? <Link href="/">로그인</Link>
      </p>
    </form>
  );
}
