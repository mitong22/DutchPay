import Link from "next/link";

import "./globals.css";

export const metadata = {
  title: {
    default: "몫대로",
    template: "%s | 몫대로",
  },
  description: "영수증의 메뉴별 참여자를 골라 정확하게 나누는 정산 서비스",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <Link className="brand" href="/" aria-label="몫대로 홈">
              <span className="brand__mark" aria-hidden="true">
                몫
              </span>
              <span>
                <strong>몫대로</strong>
                <small>먹은 만큼, 깔끔하게</small>
              </span>
            </Link>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <p>복잡한 영수증도 각자의 몫대로 나눠 보세요.</p>
        </footer>
      </body>
    </html>
  );
}
