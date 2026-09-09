import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell message-page">
      <span className="message-page__code">404</span>
      <h1>페이지를 찾을 수 없습니다.</h1>
      <p>주소가 정확한지 확인하거나 홈에서 다시 시작해 주세요.</p>
      <Link className="button button--primary" href="/">
        홈으로 돌아가기
      </Link>
    </main>
  );
}
