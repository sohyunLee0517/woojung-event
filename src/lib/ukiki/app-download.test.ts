import { describe, expect, it } from "vitest";
import { APK_URL, detectPlatform, downloadPlan } from "./app-download";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36";
const IN_APP = `${ANDROID} UkikiApp/1.0`;
const KAKAO = `${ANDROID} KAKAOTALK 10.0.0`;

describe("APK 주소", () => {
  it("항상 가장 최신 릴리스의 APK 를 가리킨다", () => {
    expect(APK_URL).toBe("https://github.com/sohyunLee0517/woojung-event/releases/latest/download/ukiki.apk");
  });
});

describe("detectPlatform", () => {
  it("안드로이드·아이폰·그 밖", () => {
    expect(detectPlatform(ANDROID)).toBe("android");
    expect(detectPlatform(IPHONE)).toBe("ios");
    expect(detectPlatform(MAC)).toBe("other");
    expect(detectPlatform(null)).toBe("other");
  });

  it("이미 우끼끼 앱 안이면 app", () => {
    expect(detectPlatform(IN_APP)).toBe("app");
  });
});

describe("downloadPlan (기기별 안내)", () => {
  it("안드로이드는 APK 받기", () => {
    expect(downloadPlan(ANDROID)).toEqual({ kind: "apk", warnInApp: false });
  });

  it("카톡 안에서 열면 다운로드가 막힐 수 있어 다른 브라우저로 열라고 안내", () => {
    expect(downloadPlan(KAKAO)).toEqual({ kind: "apk", warnInApp: true });
  });

  it("아이폰은 앱 대신 홈 화면에 추가 안내", () => {
    expect(downloadPlan(IPHONE)).toEqual({ kind: "ios_home", warnInApp: false });
  });

  it("컴퓨터면 폰으로 열라고 안내", () => {
    expect(downloadPlan(MAC)).toEqual({ kind: "open_on_phone", warnInApp: false });
  });

  it("이미 앱 안이면 받을 필요 없음", () => {
    expect(downloadPlan(IN_APP)).toEqual({ kind: "already", warnInApp: false });
  });
});
