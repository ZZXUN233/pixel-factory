import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { serialize } from '../lib/serialize';

const router = Router();

/**
 * GET /api/projects — 列出当前用户的项目
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const projects = await prisma.project.findMany({
      where: { authCenterId: user.sub },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { frames: true } } },
    });
    res.json({ projects: serialize(projects) });
  } catch (err) {
    console.error('[projects] list error:', err);
    res.status(500).json({ error: '获取项目列表失败' });
  }
});

/**
 * POST /api/projects — 创建新项目
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, width, height, palette, rle, category, description, isPublic, frames } = req.body;

    if (!name || !width || !height || !palette || !rle) {
      return res.status(400).json({ error: '缺少必要字段 (name, width, height, palette, rle)' });
    }

    const now = Date.now();
    const project = await prisma.project.create({
      data: {
        authCenterId: user.sub,
        name,
        width,
        height,
        palette: JSON.stringify(palette),
        rle,
        category: category || null,
        description: description || null,
        isPublic: isPublic || false,
        createdAt: now,
        updatedAt: now,
      },
    });

    // 如果有帧数据，一并创建
    if (frames && Array.isArray(frames) && frames.length > 0) {
      await prisma.animationFrame.createMany({
        data: frames.map((frame: { frameIndex: number; rle: string }, idx: number) => ({
          projectId: project.id,
          frameIndex: frame.frameIndex ?? idx,
          rle: JSON.stringify(frame.rle),
          createdAt: now,
        })),
      });
    }

    const created = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        frames: { orderBy: { frameIndex: 'asc' } },
      },
    });

    res.status(201).json({ project: serialize(created) });
  } catch (err) {
    console.error('[projects] create error:', err);
    res.status(500).json({ error: '创建项目失败' });
  }
});

/**
 * GET /api/projects/:id — 获取项目详情
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });

    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    if (project.authCenterId !== user.sub) {
      return res.status(403).json({ error: '无权访问此项目' });
    }

    res.json({ project: serialize(project) });
  } catch (err) {
    console.error('[projects] get error:', err);
    res.status(500).json({ error: '获取项目失败' });
  }
});

/**
 * PATCH /api/projects/:id — 更新项目
 */
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const existing = await prisma.project.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ error: '项目不存在' });
    }
    if (existing.authCenterId !== user.sub) {
      return res.status(403).json({ error: '无权修改此项目' });
    }

    const { name, palette, rle, category, description, isPublic } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: Date.now() };

    if (name !== undefined) updateData.name = name;
    if (palette !== undefined) updateData.palette = JSON.stringify(palette);
    if (rle !== undefined) updateData.rle = rle;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ project: serialize(updated) });
  } catch (err) {
    console.error('[projects] update error:', err);
    res.status(500).json({ error: '更新项目失败' });
  }
});

/**
 * DELETE /api/projects/:id — 删除项目（级联删除帧）
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const existing = await prisma.project.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ error: '项目不存在' });
    }
    if (existing.authCenterId !== user.sub) {
      return res.status(403).json({ error: '无权删除此项目' });
    }

    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('[projects] delete error:', err);
    res.status(500).json({ error: '删除项目失败' });
  }
});

/**
 * GET /api/projects/:id/frames — 获取项目的所有动画帧
 */
router.get('/:id/frames', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });

    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    if (project.authCenterId !== user.sub) {
      return res.status(403).json({ error: '无权访问' });
    }

    const frames = await prisma.animationFrame.findMany({
      where: { projectId: req.params.id },
      orderBy: { frameIndex: 'asc' },
    });

    res.json({ frames: serialize(frames) });
  } catch (err) {
    console.error('[projects] get frames error:', err);
    res.status(500).json({ error: '获取帧数据失败' });
  }
});

/**
 * POST /api/projects/:id/frames — 替换项目的所有动画帧
 */
router.post('/:id/frames', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });

    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    if (project.authCenterId !== user.sub) {
      return res.status(403).json({ error: '无权修改' });
    }

    const { frames } = req.body;
    if (!frames || !Array.isArray(frames)) {
      return res.status(400).json({ error: '请提供 frames 数组' });
    }

    const now = Date.now();

    await prisma.$transaction(async (tx) => {
      // 删除旧帧
      await tx.animationFrame.deleteMany({
        where: { projectId: req.params.id },
      });

      // 创建新帧
      await tx.animationFrame.createMany({
        data: frames.map((frame: { frameIndex: number; rle: string }, idx: number) => ({
          projectId: req.params.id,
          frameIndex: frame.frameIndex ?? idx,
          rle: JSON.stringify(frame.rle),
          createdAt: now,
        })),
      });
    });

    const updated = await prisma.animationFrame.findMany({
      where: { projectId: req.params.id },
      orderBy: { frameIndex: 'asc' },
    });

    res.json({ frames: serialize(updated) });
  } catch (err) {
    console.error('[projects] replace frames error:', err);
    res.status(500).json({ error: '保存帧数据失败' });
  }
});

// ────────────────────────────────────────────────
//  Reviews
// ────────────────────────────────────────────────

/** 重新计算 avgScore 和 reviewCount */
async function recalcProjectScore(projectId: string) {
  const stats = await prisma.projectReview.aggregate({
    where: { projectId, type: 'review', status: 'active' },
    _avg: { score: true },
    _count: true,
  });
  await prisma.project.update({
    where: { id: projectId },
    data: {
      avgScore: stats._avg.score ?? 0,
      reviewCount: stats._count,
    },
  });
}

/**
 * POST /api/projects/:id/reviews — 提交评价或评论
 */
router.post('/:id/reviews', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });

    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const { type, content, score } = req.body;

    if (type !== 'review' && type !== 'comment') {
      return res.status(400).json({ error: 'type 必须为 "review" 或 "comment"' });
    }

    if (type === 'review') {
      if (score === undefined || score === null) {
        return res.status(400).json({ error: '评价必须提供 score' });
      }
      const scoreInt = Math.round(score);
      if (scoreInt < 1 || scoreInt > 10) {
        return res.status(400).json({ error: 'score 必须在 1-10 之间' });
      }
    }

    const now = Date.now();
    const review = await prisma.projectReview.create({
      data: {
        projectId: req.params.id,
        authCenterId: user.sub,
        type,
        content: content || '',
        score: type === 'review' ? Math.round(score) : null,
        createdAt: now,
        updatedAt: now,
      },
    });

    // 如果是评分，重算 avgScore
    if (type === 'review') {
      await recalcProjectScore(req.params.id);
    }

    res.status(201).json({ review: serialize(review) });
  } catch (err) {
    console.error('[projects] create review error:', err);
    res.status(500).json({ error: '提交评价失败' });
  }
});

/**
 * DELETE /api/projects/:id/reviews/:reviewId — 软删除评价
 */
router.delete('/:id/reviews/:reviewId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const review = await prisma.projectReview.findUnique({
      where: { id: req.params.reviewId },
    });

    if (!review || review.projectId !== req.params.id) {
      return res.status(404).json({ error: '评价不存在' });
    }
    if (review.authCenterId !== user.sub) {
      return res.status(403).json({ error: '无权删除' });
    }

    await prisma.projectReview.update({
      where: { id: req.params.reviewId },
      data: { status: 'deleted', updatedAt: Date.now() },
    });

    // 如果是评分，重算 avgScore
    if (review.type === 'review') {
      await recalcProjectScore(req.params.id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[projects] delete review error:', err);
    res.status(500).json({ error: '删除评价失败' });
  }
});

// ────────────────────────────────────────────────
//  Favorites
// ────────────────────────────────────────────────

/**
 * POST /api/projects/:id/favorite — 切换收藏
 */
router.post('/:id/favorite', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });

    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const existing = await prisma.projectFavorite.findUnique({
      where: { projectId_authCenterId: { projectId: req.params.id, authCenterId: user.sub } },
    });

    if (existing) {
      await prisma.projectFavorite.delete({ where: { id: existing.id } });
      return res.json({ favorited: false });
    }

    await prisma.projectFavorite.create({
      data: { projectId: req.params.id, authCenterId: user.sub, createdAt: Date.now() },
    });

    res.json({ favorited: true });
  } catch (err) {
    console.error('[projects] favorite error:', err);
    res.status(500).json({ error: '操作收藏失败' });
  }
});

/**
 * GET /api/projects/:id/favorite — 查询当前用户收藏状态
 */
router.get('/:id/favorite', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const existing = await prisma.projectFavorite.findUnique({
      where: { projectId_authCenterId: { projectId: req.params.id, authCenterId: user.sub } },
    });
    res.json({ favorited: !!existing });
  } catch (err) {
    console.error('[projects] check favorite error:', err);
    res.status(500).json({ error: '查询收藏状态失败' });
  }
});

export default router;