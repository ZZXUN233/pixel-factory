import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../lib/jwt';

export function getAuthUser(req: Request): JwtPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}

/**
 * Express 中间件：将用户信息附加到 req，不阻塞
 */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  (req as any).user = getAuthUser(req);
  next();
}

/**
 * Express 中间件：要求登录，未登录返回 401
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  (req as any).user = user;
  next();
}

/**
 * Express 中间件：要求管理员权限
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  if (!user.roles?.includes('admin')) {
    res.status(403).json({ error: '无权限' });
    return;
  }
  next();
}