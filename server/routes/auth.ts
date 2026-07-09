import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getAuthorizationUrl, exchangeCode, getUserInfo } from '../lib/auth-center';
import { signToken } from '../lib/jwt';
import { saveUserCache } from '../lib/user-cache';
import { getAuthUser } from '../middleware/auth';

const router = Router();
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

/**
 * GET /api/auth/login — 302 跳转到 auth-center 登录
 */
router.get('/login', (_req: Request, res: Response) => {
  const state = randomUUID();
  const authUrl = getAuthorizationUrl(state);
  res.redirect(302, authUrl);
});

/**
 * GET /api/auth/callback — OAuth2 回调
 */
router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;

  if (!code) {
    return res.redirect(302, `${APP_URL}?error=missing_code`);
  }

  try {
    const tokenData = await exchangeCode(code);
    if (!tokenData) {
      return res.redirect(302, `${APP_URL}?error=exchange_failed`);
    }

    const userInfo = await getUserInfo(tokenData.access_token);
    if (!userInfo) {
      return res.redirect(302, `${APP_URL}?error=userinfo_failed`);
    }

    // 写入用户缓存
    try {
      await saveUserCache({
        id: userInfo.id,
        nickname: userInfo.nickname,
        avatar_url: userInfo.avatar_url,
      });
      console.log(`[callback] userCache saved: ${userInfo.id} (${userInfo.nickname || 'no nickname'})`);
    } catch (err) {
      console.error('[callback] saveUserCache failed:', err);
    }

    // 签发本地 JWT
    const token = signToken({
      sub: userInfo.id,
      email: userInfo.email || undefined,
      nickname: userInfo.nickname || undefined,
      roles: userInfo.roles || [],
    });

    // 通过 cookie 传递 token，然后重定向到首页
    res.cookie('auth_token', token, {
      path: '/',
      maxAge: 60 * 1000, // 60 秒
      sameSite: 'lax',
    });
    res.redirect(302, `${APP_URL}?login=success`);
  } catch (err) {
    console.error('[auth/callback] Error:', err);
    res.redirect(302, `${APP_URL}?error=internal`);
  }
});

/**
 * GET /api/auth/profile — 获取当前用户信息
 */
router.get('/profile', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: '未登录' });
  }

  res.json({
    user: {
      id: user.sub,
      email: user.email,
      nickname: user.nickname,
      roles: user.roles || [],
    },
  });
});

export default router;