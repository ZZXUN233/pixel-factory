/**
 * Auth Center OAuth2 Client
 * 用于与 auth.zzxun.cn 用户中心对接
 */

const AUTH_CENTER_URL = process.env.AUTH_CENTER_URL || 'http://localhost:3010';
const AUTH_CLIENT_ID = process.env.AUTH_CLIENT_ID || 'pixel-factory';
const AUTH_CLIENT_SECRET = process.env.AUTH_CLIENT_SECRET || '';
const AUTH_REDIRECT_URI = process.env.AUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

/**
 * 生成 OAuth2 授权跳转 URL
 */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: AUTH_CLIENT_ID,
    redirect_uri: AUTH_REDIRECT_URI,
    response_type: 'code',
    scope: 'profile,email',
    state,
  });
  return `${AUTH_CENTER_URL}/oauth/authorize?${params.toString()}`;
}

/**
 * 用 authorization code 换取 access_token
 */
export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  try {
    const res = await fetch(`${AUTH_CENTER_URL}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: AUTH_CLIENT_ID,
        client_secret: AUTH_CLIENT_SECRET,
        redirect_uri: AUTH_REDIRECT_URI,
      }),
    });

    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error('[auth-center] exchangeCode failed:', err);
    return null;
  }
}

/**
 * 用 access_token 获取用户信息（含 roles）
 */
export async function getUserInfo(accessToken: string): Promise<{
  id: string;
  email?: string;
  nickname?: string;
  avatar_url?: string;
  email_verified?: boolean;
  roles: string[];
} | null> {
  try {
    const res = await fetch(
      `${AUTH_CENTER_URL}/api/oauth/userinfo?client_id=${AUTH_CLIENT_ID}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error('[auth-center] getUserInfo failed:', err);
    return null;
  }
}