import { createSign } from "node:crypto";

// Firebase 커스텀 토큰 = 서비스 계정 키로 서명한 JWT (firebase-admin/auth 없이 직접 만든다)
// https://firebase.google.com/docs/auth/admin/create-custom-tokens#create_custom_tokens_using_a_third-party_jwt_library
const AUD = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

const b64url = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");

export function createFirebaseCustomToken(
  sa: { client_email: string; private_key: string },
  uid: string,
  nowSec = Math.floor(Date.now() / 1000),
) {
  if (!uid || uid.length > 128) throw new Error("uid 는 1~128자여야 해요");
  const header = b64url({ alg: "RS256", typ: "JWT" });
  const payload = b64url({ iss: sa.client_email, sub: sa.client_email, aud: AUD, uid, iat: nowSec, exp: nowSec + 3600 });
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(sa.private_key).toString("base64url")}`;
}
