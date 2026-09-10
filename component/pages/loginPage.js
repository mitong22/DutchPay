"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import BrandLogo from "../brandLogo";
import styles from "../app.module.css";
import {
  MOCK_LOGIN_ID,
  MOCK_LOGIN_PASSWORD,
} from "@/lib/mockSession.mjs";
import { ensureDemoData } from "@/lib/demoStore";

export default function LoginPage({ captain }) {
  const router = useRouter();
  const [validationMessage, setValidationMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function login(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setValidationMessage("");

    try {
      const response = await fetch("/api/mock-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: formData.get("loginId"),
          password: formData.get("password"),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message ?? "로그인하지 못했어요.");
      }

      ensureDemoData(captain);
      router.replace("/dashboard");
    } catch (error) {
      setValidationMessage(error.message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.loginShell}>
      <header className={`${styles.header} ${styles.loginHeader}`}>
        <span className={styles.brand}><BrandLogo /></span>
        <span>테스트 환경</span>
      </header>

      <main className={`${styles.main} ${styles.loginMain}`}>
        <section className={styles.loginHero} aria-labelledby="welcome-title">
          <p className={styles.eyebrow}>영수증 기반 더치페이</p>
          <h1 id="welcome-title">복잡한 정산,<br />먹은 만큼만 나눠요.</h1>
          <p>
            영수증을 모으고 메뉴별 참여자를 고르면
            마지막 송금 금액까지 한눈에 확인할 수 있어요.
          </p>

          <ol className={styles.loginSteps} aria-label="몫대로 이용 순서">
            <li><span>01</span><strong>영수증 등록</strong></li>
            <li><span>02</span><strong>먹은 사람 선택</strong></li>
            <li><span>03</span><strong>송금 금액 확인</strong></li>
          </ol>
        </section>

        <section
          className={`${styles.card} ${styles.loginCard}`}
          aria-labelledby="login-title"
        >
          <div className={styles.intro}>
            <p className={styles.eyebrow}>총대 계정</p>
            <h2 id="login-title">로그인</h2>
            <p>테스트 계정으로 정산 기능을 확인해 보세요.</p>
          </div>

          <dl className={styles.testCredentials} aria-label="테스트 계정 정보">
            <div><dt>아이디</dt><dd>{MOCK_LOGIN_ID}</dd></div>
            <div><dt>비밀번호</dt><dd>{MOCK_LOGIN_PASSWORD}</dd></div>
          </dl>

          <form className={styles.loginForm} onSubmit={login}>
            <label className={styles.fieldLabel} htmlFor="login-id">아이디</label>
            <input
              className={styles.textInput}
              id="login-id"
              name="loginId"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              placeholder={MOCK_LOGIN_ID}
              required
              onChange={() => setValidationMessage("")}
            />
            <label className={styles.fieldLabel} htmlFor="login-password">비밀번호</label>
            <input
              className={styles.textInput}
              id="login-password"
              name="password"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder={MOCK_LOGIN_PASSWORD}
              required
              onChange={() => setValidationMessage("")}
            />
            {validationMessage && (
              <p className={styles.errorMessage} role="alert">{validationMessage}</p>
            )}
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
