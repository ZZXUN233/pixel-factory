import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { serialize } from '../lib/serialize';
import { getCachedUser } from '../lib/user-cache';

const router = Router();

/**
 * GET /api/gallery — 公开作品列表
 * Query: search, category, sortBy (newest|popular|rating), page, limit
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string) || '';
    const category = (req.query.category as string) || '';
    const sortBy = (req.query.sortBy as string) || 'newest';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isPublic: true };

    if (search) {
      where.name = { contains: search };
    }
    if (category) {
      where.category = category;
    }

    let orderBy: Record<string, string>;
    switch (sortBy) {
      case 'popular':
        orderBy = { reviewCount: 'desc' };
        break;
      case 'rating':
        orderBy = { avgScore: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const [total, projects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: { select: { frames: true, reviews: { where: { status: 'active' } }, favorites: true } },
        },
      }),
    ]);

    // Enrich author info from cache
    const authCenterIds = [...new Set(projects.map((p) => p.authCenterId))];
    const enriched = new Map<string, { nickname: string | null; avatarUrl: string | null }>();
    for (const id of authCenterIds) {
      const user = await getCachedUser(id);
      if (user) enriched.set(id, { nickname: user.nickname, avatarUrl: user.avatarUrl });
    }

    const items = projects.map((p) => {
      const serialized = serialize(p) as Record<string, unknown>;
      return { ...serialized, author: enriched.get(p.authCenterId) || null };
    });

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[gallery] list error:', err);
    res.status(500).json({ error: '获取作品列表失败' });
  }
});

/**
 * GET /api/gallery/:id — 公开作品详情
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, isPublic: true },
      include: {
        _count: { select: { frames: true, reviews: { where: { status: 'active' } }, favorites: true } },
      },
    });

    if (!project) {
      return res.status(404).json({ error: '作品不存在' });
    }

    const author = await getCachedUser(project.authCenterId);
    const serialized = serialize(project) as Record<string, unknown>;

    res.json({ project: { ...serialized, author } });
  } catch (err) {
    console.error('[gallery] detail error:', err);
    res.status(500).json({ error: '获取作品详情失败' });
  }
});

/**
 * GET /api/gallery/:id/reviews — 作品的评价与评论列表
 */
router.get('/:id/reviews', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const type = req.query.type as string; // optional: "review" | "comment"
    const where: Record<string, unknown> = {
      projectId: req.params.id,
      status: 'active',
    };
    if (type) where.type = type;

    const [total, reviews] = await Promise.all([
      prisma.projectReview.count({ where }),
      prisma.projectReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Enrich author info
    const authCenterIds = [...new Set(reviews.map((r) => r.authCenterId))];
    const enriched = new Map<string, { nickname: string | null }>();
    for (const id of authCenterIds) {
      const user = await getCachedUser(id);
      if (user) enriched.set(id, { nickname: user.nickname });
    }

    const items = reviews.map((r) => {
      const serialized = serialize(r) as Record<string, unknown>;
      return { ...serialized, author: enriched.get(r.authCenterId) || null };
    });

    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[gallery] reviews error:', err);
    res.status(500).json({ error: '获取评价列表失败' });
  }
});

export default router;