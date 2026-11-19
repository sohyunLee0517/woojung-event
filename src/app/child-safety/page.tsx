import { LegalPage, listStyle, MailLink, Section } from "@/components/ukiki/LegalPage";

export const metadata = { title: "아동 안전 표준 · 우끼끼" };

// 구글 플레이 아동 안전 표준(CSAE) 공개 페이지
export default function ChildSafetyPage() {
  return (
    <LegalPage title="아동 안전 표준" updated="2026년 11월 19일">
      <p>
        우끼끼는 아동 성적 학대 및 착취(CSAE)와 아동 성적 학대 콘텐츠(CSAM)를 절대 허용하지 않아요. 이를 어기는 사용자와 콘텐츠는
        발견 즉시 조치해요.
      </p>

      <Section title="금지하는 것">
        <ul style={listStyle}>
          <li>아동을 성적으로 표현하거나 착취하는 모든 콘텐츠와 행위</li>
          <li>아동에게 접근해 성적인 목적으로 길들이는 행위(그루밍)</li>
          <li>아동의 위치 등 개인정보를 이용해 해를 끼치려는 행위</li>
        </ul>
      </Section>

      <Section title="앱 안에서 신고하기">
        <p>
          앱 첫 화면의 프로필 사진 → <b>신고하기</b>, 또는 방 오른쪽 위 메뉴 → <b>신고하기</b>에서 &apos;아동 안전&apos;을 골라 신고할 수 있어요.
          신고는 관리자가 확인해요.
        </p>
      </Section>

      <Section title="신고를 받으면">
        <ul style={listStyle}>
          <li>해당 사용자를 방에서 내보내고 이용을 막는 등 바로 조치해요.</li>
          <li>아동 성적 학대 콘텐츠가 확인되면 관련 법에 따라 수사기관 등 관계 기관에 신고해요.</li>
        </ul>
      </Section>

      <Section title="아동 안전 담당 연락처">
        <p>
          <MailLink subject="우끼끼 아동 안전 문의" />
        </p>
      </Section>
    </LegalPage>
  );
}
