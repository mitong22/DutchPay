export default function GroupLoading() {
  return (
    <main className="page-shell loading-page" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <p>모임과 정산 내역을 불러오고 있습니다.</p>
    </main>
  );
}
