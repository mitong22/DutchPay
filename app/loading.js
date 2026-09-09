export default function Loading() {
  return (
    <main className="page-shell loading-page" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <p>정산 정보를 불러오고 있습니다.</p>
    </main>
  );
}
