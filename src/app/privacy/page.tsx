import { LegalPage, listStyle, MailLink, Section } from "@/components/ukiki/LegalPage";

export const metadata = { title: "개인정보처리방침 · 우끼끼" };

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" updated="2026년 11월 20일">
      <p>
        우끼끼(이하 &apos;서비스&apos;)는 친구들끼리 방을 만들어 미니게임을 하는 서비스예요. 서비스에 필요한 최소한의 정보만 모으고, 아래처럼
        쓰고 지워요.
      </p>

      <Section title="1. 모으는 정보와 쓰는 곳">
        <ul style={listStyle}>
          <li>
            <b>카카오 로그인 정보</b>: 카카오 회원번호, 닉네임, 프로필 사진 — 로그인하고 방에서 나를 보여 주는 데 써요.
          </li>
          <li>
            <b>위치 (정확한 위치, 앱을 쓰지 않을 때 포함)</b>: 같은 방 친구들의 지도에 내 위치를 보여 주는 데 써요. 서버에는 가장
            마지막 위치 하나만 저장하고, 같은 방 멤버만 볼 수 있어요. 앱을 닫아 두어도 몇 분마다 위치를 보낼 수 있으며, 휴대폰
            설정에서 언제든 끌 수 있어요.
          </li>
          <li>
            <b>알림 받는 기기 정보</b>: 알림 토큰, 브라우저·기기 종류, 마지막 접속 시각 — 새 게임·재촉 알림을 마지막에 쓴 기기로
            보내는 데 써요.
          </li>
          <li>
            <b>게임 기록</b>: 들어간 방, 게임 참여 여부, 탭 수, 뽑기 결과 — 게임 진행과 방의 &apos;지난 게임&apos;을 보여 주는 데 써요.
          </li>
          <li>
            <b>AI 게임 만들기</b>: 게임을 만들거나 고칠 때 적은 요청(프롬프트), AI가 만든 게임 코드와 제목, 확정 여부 — 방에서 같이 할
            게임을 만들고 보여 주는 데 써요. 요청을 보내면 게임을 만들기 위해 요청과 지금 게임 코드를 아래 AI 회사(Anthropic)로
            보내요. 요청에 이름·연락처 같은 개인정보는 적지 말아 주세요.
          </li>
          <li>
            <b>바나나 기록</b>: 게임으로 받은 바나나와 AI 게임 만들기에 쓴 바나나 — 바나나 잔액을 보여 주는 데 써요.
          </li>
          <li>
            <b>카메라·마이크</b>: 우정의 온도 영상 기능에서만 써요. 영상은 친구에게 실시간으로만 전달하고 저장하지 않아요. (지금은 이
            기능을 쓰지 않아요)
          </li>
        </ul>
      </Section>

      <Section title="2. 보관 기간">
        <p>
          회원 탈퇴 시 프로필 사진, 위치, 알림 기기 정보는 바로 지워요. 친구들과 함께 한 게임 기록은 그 방의 기록이 깨지지 않도록
          남기되, 이름은 &apos;알 수 없음&apos;으로 바꿔 누구인지 알 수 없게 해요.
        </p>
        <p style={{ marginTop: 6 }}>
          AI로 만든 게임과 그 요청은 만든 사람이 지우거나 방이 없어질 때까지 보관해요. 만들다 그만둔 게임은 &apos;새로 만들기&apos;를
          하면 지워져요.
        </p>
      </Section>

      <Section title="3. 다른 곳에 주는 정보">
        <p>개인정보를 다른 회사나 사람에게 팔거나 넘기지 않아요. 광고도 없어요. (광고를 넣게 되면 이 방침을 먼저 고쳐 알려 드려요)</p>
        <p style={{ marginTop: 6 }}>서비스를 돌리기 위해 아래 회사의 서비스를 써요.</p>
        <ul style={listStyle}>
          <li>Vercel — 웹 서버</li>
          <li>Neon — 데이터베이스</li>
          <li>Google Firebase — 실시간 게임 연결, 알림 전송</li>
          <li>Kakao — 로그인</li>
          <li>Anthropic — AI 게임 만들기 (게임을 만들 때 적은 요청과 게임 코드를 보내요. 게임을 만드는 데만 써요)</li>
        </ul>
      </Section>

      <Section title="4. 내 정보 관리">
        <ul style={listStyle}>
          <li>위치 공유는 휴대폰 설정 → 우끼끼 → 위치에서 끌 수 있어요.</li>
          <li>
            회원 탈퇴는 앱에서 프로필 사진 → <b>회원 탈퇴</b>로 할 수 있어요. 자세한 방법은{" "}
            <a href="/account-deletion" style={{ color: "#FEE500" }}>
              계정 삭제 안내
            </a>
            를 봐 주세요.
          </li>
          <li>
            그 밖의 요청은 <MailLink subject="우끼끼 개인정보 문의" /> 로 보내 주세요.
          </li>
        </ul>
      </Section>

      <Section title="5. 어린이">
        <p>만 14세 미만 어린이는 보호자의 동의를 받아 이용해 주세요.</p>
      </Section>

      <Section title="6. 방침이 바뀌면">
        <p>이 방침이 바뀌면 이 페이지에 시행일과 함께 알려 드려요.</p>
      </Section>
    </LegalPage>
  );
}
