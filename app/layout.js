import "./globals.css";

export const metadata = {
  title: "몫대로",
  description: "메뉴별 참여자를 기준으로 비용을 나누는 더치페이 서비스",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
