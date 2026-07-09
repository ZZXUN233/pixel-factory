/**
 * Auth Center OAuth2 Client
 * 用于与 auth.zzxun.cn 用户中心对接
 *
 * 注意：使用惰性读取环境变量，避免 ESM 静态导入时 dotenv 尚未加载
 */

function getConfig() {
  return {
    url: process.env.AUTH_CENTER_URL || 'https://auth.zzxun.cn',
    clientId: process.env.AUTH_CLIENT_ID || 'pixel-factory',
    clientSecret: process.env.AUTH_CLIENT_SECRET || '',
    redirectUri: process.env.AUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
  };
}

/**
 * 生成 OAuth2 授权跳转 URL
 */
export function getAuthorizationUrl(state: string): string {
  const { url, clientId, redirectUri } = getConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'profile,email',
    state,
  });
  return `${url}/oauth/authorize?${params.toString()}`;
}

/**
 * 用 authorization code 换取 access_token
 */
export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  const { url, clientId, clientSecret, redirectUri } = getConfig();
  try {
    const res = await fetch(`${url}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
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
  const { url, clientId } = getConfig();
  try {
    const res = await fetch(
      `${url}/api/oauth/userinfo?client_id=${clientId}`,
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