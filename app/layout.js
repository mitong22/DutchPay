import "./globals.css";

export const metadata = {
  title: "몫대로 | 메뉴별 더치페이",
  description: "먹은 메뉴만큼 정확하게 나누는 더치페이",
};

export default function RootLayout({ children }) {
  // 카카오톡 웹뷰가 hydration 전에 html/body의 속성과 글자 크기를 추가한다.
  return (
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
