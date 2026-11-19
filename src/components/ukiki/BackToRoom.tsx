import type { CSSProperties } from "react";
import { ghostButton, primaryButton } from "./styles";

// 게임이 끝난 화면 공통 "방으로 돌아가기" 버튼
export default function BackToRoom({
  href,
  primary = false,
  className,
  style,
}: {
  href: string;
  /** 노란 큰 버튼으로 */
  primary?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <a href={href} className={className} style={{ ...(primary ? primaryButton : ghostButton), textDecoration: "none", textAlign: "center", ...style }}>
      방으로 돌아가기
    </a>
  );
}
