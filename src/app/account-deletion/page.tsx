import { LegalPage, listStyle, MailLink, Section, stepStyle } from "@/components/ukiki/LegalPage";

export const metadata = { title: "계정 삭제 안내 · 우끼끼" };

export default function AccountDeletionPage() {
  return (
    <LegalPage title="우끼끼 계정 삭제 안내" updated="2026년 11월 19일">
      <Section title="앱에서 직접 지우기">
        <ol style={stepStyle}>
          <li>우끼끼 앱(또는 웹)에 카카오로 로그인해요.</li>
          <li>첫 화면 왼쪽 위 프로필 사진을 눌러요.</li>
          <li>
            <b>회원 탈퇴</b>를 눌러요.
          </li>
          <li>내가 만든 방이 있으면 먼저 없애요. &apos;내 방 확인하기&apos;를 눌러 방에 들어간 뒤 오른쪽 위 메뉴 → &apos;방 없애기&apos;.</li>
          <li>
            <b>회원 탈퇴</b> → <b>탈퇴하기</b>를 누르면 끝나요.
          </li>
        </ol>
      </Section>

      <Section title="지워지는 정보">
        <ul style={listStyle}>
          <li>프로필 사진</li>
          <li>마지막 위치</li>
          <li>알림 받는 기기 정보</li>
          <li>들어가 있던 방의 멤버 정보</li>
        </ul>
      </Section>

      <Section title="남는 정보">
        <p>
          친구들과 함께 한 게임 기록(탭 수, 뽑기 결과)은 친구들의 방 기록이 깨지지 않도록 남지만, 이름은 &apos;알 수 없음&apos;으로
          바뀌어 누구인지 알 수 없어요.
        </p>
      </Section>

      <Section title="앱에 들어갈 수 없을 때">
        <p>
          <MailLink subject="우끼끼 계정 삭제" /> 로 &apos;우끼끼 계정 삭제&apos;라고 보내 주세요. 카카오 닉네임을 함께 알려 주시면 7일 안에 지워 드려요.
        </p>
      </Section>
    </LegalPage>
  );
}
