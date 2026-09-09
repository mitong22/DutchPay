"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, retry }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-shell message-page">
      <span className="message-page__code">!</span>
      <h1>화면을 불러오지 못했습니다.</h1>
      <p>잠시 후 다시 시도해 주세요. 문제가 계속되면 처음부터 다시 열어 주세요.</p>
      <button className="button button--primary" type="button" onClick={retry}>
        다시 시도
      </button>
    </main>
  );
}
