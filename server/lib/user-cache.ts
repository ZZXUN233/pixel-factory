import { prisma } from './prisma';

export interface CachedUserInfo {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
}

/**
 * 获取单个用户缓存信息（缺失时回源 auth-center）
 */
export async function getCachedUser(
  authCenterId: string
): Promise<CachedUserInfo | null> {
  const map = await syncUsersCache([authCenterId]);
  return map.get(authCenterId) || null;
}

/**
 * 批量同步用户信息到本地缓存
 */
export async function syncUsersCache(
  ids: string[]
): Promise<Map<string, CachedUserInfo>> {
  if (ids.length === 0) return new Map();

  const uniqueIds = [...new Set(ids)];
  const result = new Map<string, CachedUserInfo>();

  // 1. 查本地已有缓存
  const cached = await prisma.userCache.findMany({
    where: { authCenterId: { in: uniqueIds } },
  });
  for (const c of cached) {
    result.set(c.authCenterId, {
      id: c.authCenterId,
      nickname: c.nickname,
      avatarUrl: c.avatarUrl,
    });
  }

  // 2. 找缺失的 ID
  const missing = uniqueIds.filter((id) => !result.has(id));
  if (missing.length > 0) {
    const fetched = await fetchUsersFromAuthCenter(missing);
    const now = Date.now();
    await prisma.$transaction(
      fetched.map((u) =>
        prisma.userCache.upsert({
          where: { authCenterId: u.id },
          update: {
            nickname: u.nickname,
            avatarUrl: u.avatarUrl,
            lastSyncedAt: now,
          },
          create: {
            authCenterId: u.id,
            nickname: u.nickname,
            avatarUrl: u.avatarUrl,
            lastSyncedAt: now,
          },
        })
      )
    );
    for (const u of fetched) {
      result.set(u.id, {
        id: u.id,
        nickname: u.nickname,
        avatarUrl: u.avatarUrl,
      });
    }
  }

  return result;
}

/**
 * 保存用户信息到缓存（用于 OAuth callback 等已知 userinfo 的场景）
 */
export async function saveUserCache(info: {
  id: string;
  nickname?: string | null;
  avatar_url?: string | null;
}): Promise<void> {
  await prisma.userCache.upsert({
    where: { authCenterId: info.id },
    update: {
      nickname: info.nickname ?? null,
      avatarUrl: info.avatar_url ?? null,
      lastSyncedAt: Date.now(),
    },
    create: {
      authCenterId: info.id,
      nickname: info.nickname ?? null,
      avatarUrl: info.avatar_url ?? null,
      lastSyncedAt: Date.now(),
    },
  });
}

/**
 * 通过 OAuth2 Client Credentials 从 auth-center 回源获取用户信息
 */
async function fetchUsersFromAuthCenter(
  ids: string[]
): Promise<Array<{ id: string; nickname: string | null; avatarUrl: string | null }>> {
  try {
    const AUTH_CENTER_URL = process.env.AUTH_CENTER_URL || 'http://localhost:3010';
    const tokenRes = await fetch(`${AUTH_CENTER_URL}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.AUTH_CLIENT_ID,
        client_secret: process.env.AUTH_CLIENT_SECRET,
        scope: 'internal',
      }),
    });
    if (!tokenRes.ok) return [];
    const tokenData = await tokenRes.json();

    const userRes = await fetch(`${AUTH_CENTER_URL}/api/internal/users/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify({ ids }),
    });
    if (!userRes.ok) return [];
    const data = await userRes.json();
    return (data.users || []).map((u: any) => ({
      id: u.id,
      nickname: u.nickname || null,
      avatarUrl: u.avatar_url || null,
    }));
  } catch (err) {
    console.error('[user-cache] fetchUsersFromAuthCenter failed:', err);
    return [];
  }
}