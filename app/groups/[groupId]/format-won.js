const wonFormatter = new Intl.NumberFormat("ko-KR");

export function formatWon(amount) {
  return `${wonFormatter.format(amount)}원`;
}
