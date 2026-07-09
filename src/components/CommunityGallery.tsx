import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Search,
  Star,
  Heart,
  MessageCircle,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  TrendingUp,
  Sparkles,
  Info,
  LogIn,
} from 'lucide-react';
import { fetchWithAuth, getToken } from '../lib/auth';
import { decodeRLE } from '../utils';

interface GalleryProject {
  id: string;
  name: string;
  width: number;
  height: number;
  palette: string;
  rle: string;
  category?: string;
  description?: string;
  avgScore?: number;
  reviewCount: number;
  createdAt: number;
  author?: { nickname: string | null; avatarUrl: string | null } | null;
  _count?: { frames: number; reviews: number; favorites: number };
}

interface GalleryResponse {
  items: GalleryProject[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface ReviewItem {
  id: string;
  type: 'review' | 'comment';
  content: string;
  score?: number;
  createdAt: number;
  author?: { nickname: string | null } | null;
}

export const CommunityGallery: React.FC<{
  user?: { id: string; nickname?: string } | null;
  isLoggedIn?: boolean;
}> = ({ user, isLoggedIn: propIsLoggedIn }) => {
  const isLoggedIn = propIsLoggedIn || !!user;

  const [projects, setProjects] = useState<GalleryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail modal state
  const [selectedProject, setSelectedProject] = useState<GalleryProject | null>(null);
  const [detailGrid, setDetailGrid] = useState<string[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [reviewForm, setReviewForm] = useState({ type: 'review' as 'review' | 'comment', score: 5, content: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sortBy, page: String(page), limit: '12' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/gallery?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data: GalleryResponse = await res.json();
      setProjects(data.items);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, page]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Load detail when project selected
  const openDetail = async (proj: GalleryProject) => {
    setSelectedProject(proj);
    const palette = JSON.parse(proj.palette);
    setDetailGrid(decodeRLE(proj.rle, proj.width, proj.height, palette));

    // Load reviews
    setReviewsLoading(true);
    try {
      const res = await fetch(`/api/gallery/${proj.id}/reviews?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReviewsLoading(false);
    }

    // Check favorite if logged in
    if (isLoggedIn) {
      try {
        const favRes = await fetchWithAuth(`/api/projects/${proj.id}/favorite`);
        if (favRes.ok) {
          const data = await favRes.json();
          setFavorited(data.favorited);
        }
      } catch {}
    }
  };

  const handleToggleFavorite = async () => {
    if (!isLoggedIn || !selectedProject) return;
    try {
      const res = await fetchWithAuth(`/api/projects/${selectedProject.id}/favorite`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setFavorited(data.favorited);
      }
    } catch {}
  };

  const handleSubmitReview = async () => {
    if (!isLoggedIn || !selectedProject) return;
    setReviewSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/projects/${selectedProject.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reviewForm.type,
          content: reviewForm.content,
          score: reviewForm.type === 'review' ? reviewForm.score * 2 : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReviews((prev) => [
          { ...data.review, author: { nickname: user?.nickname || null } },
          ...prev,
        ]);
        setReviewForm({ type: 'review', score: 5, content: '' });
        // Refresh project stats
        fetchProjects();
      }
    } catch {
    } finally {
      setReviewSubmitting(false);
    }
  };

  const renderStars = (score10: number) => {
    const stars = score10 / 2;
    const full = Math.floor(stars);
    const half = stars - full >= 0.25;
    return (
      <span className="inline-flex items-center gap-0.5 text-amber-500">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="text-xs">{i < full ? '★' : i === full && half ? '★' : '☆'}</span>
        ))}
        <span className="ml-1 text-[10px] text-slate-400 font-mono">{stars.toFixed(1)}</span>
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Globe className="h-5 w-5 text-emerald-600" />
        <h2 className="text-base font-bold text-slate-800">作品广场</h2>
        <span className="text-[10px] text-slate-400 font-mono ml-auto">浏览社区公开像素作品</span>
      </div>

      {/* Search & Sort Bar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            id="gallery-search-input"
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜索作品名称..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          id="gallery-sort-select"
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg py-1.5 px-2 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="newest">最新发布</option>
          <option value="popular">最多评价</option>
          <option value="rating">评分最高</option>
        </select>
      </div>

      {/* Project Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-xs">加载中...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Globe className="h-8 w-8 text-slate-300 mb-2" />
          <p className="text-xs text-slate-500">暂无公开作品</p>
          <p className="text-[10px] text-slate-400 mt-1">登录后可在作品库将作品设为公开</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {projects.map((proj) => {
              const palette = JSON.parse(proj.palette);
              const decoded = decodeRLE(proj.rle, proj.width, proj.height, palette);
              return (
                <button
                  key={proj.id}
                  onClick={() => openDetail(proj)}
                  className="bg-slate-50 border border-slate-200 hover:border-emerald-300 rounded-xl p-3 text-left transition-all group cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div
                    className="grid rounded border border-slate-200 bg-white p-0.5 overflow-hidden mx-auto mb-2"
                    style={{
                      gridTemplateColumns: `repeat(${proj.width}, 1fr)`,
                      width: '100%',
                      aspectRatio: `${proj.width}/${proj.height}`,
                      maxWidth: '120px',
                    }}
                  >
                    {decoded.map((color: string, idx: number) => (
                      <div
                        key={idx}
                        style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }}
                      />
                    ))}
                  </div>
                  {/* Info */}
                  <p className="text-[11px] font-bold text-slate-700 truncate group-hover:text-emerald-600">{proj.name}</p>
                  <p className="text-[9px] text-slate-400 truncate">
                    {proj.author?.nickname || '匿名'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {proj.avgScore != null && proj.avgScore > 0 && renderStars(proj.avgScore)}
                    <span className="text-[9px] text-slate-400 ml-auto">
                      {proj._count?.reviews || 0}评 · {proj._count?.favorites || 0}藏
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                id="gallery-prev-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-slate-500 font-mono">{page} / {totalPages}</span>
              <button
                id="gallery-next-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={() => setSelectedProject(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">{selectedProject.name}</h3>
                {selectedProject.avgScore != null && selectedProject.avgScore > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-500">
                    {renderStars(selectedProject.avgScore)}
                  </span>
                )}
              </div>
              <button
                id="gallery-detail-close"
                onClick={() => setSelectedProject(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Pixel Art Display */}
              <div className="flex justify-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div
                  className="grid border border-slate-200 bg-white p-0.5 overflow-hidden"
                  style={{
                    gridTemplateColumns: `repeat(${selectedProject.width}, 1fr)`,
                    width: `${Math.min(selectedProject.width * 8, 240)}px`,
                    height: `${Math.min(selectedProject.height * 8, 240)}px`,
                  }}
                >
                  {detailGrid.map((color: string, idx: number) => (
                    <div
                      key={idx}
                      style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }}
                    />
                  ))}
                </div>
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500">
                <div className="bg-slate-50 rounded-lg py-1.5">
                  <p className="font-bold text-slate-700">{selectedProject.width}×{selectedProject.height}</p>
                  <p>尺寸</p>
                </div>
                <div className="bg-slate-50 rounded-lg py-1.5">
                  <p className="font-bold text-slate-700">{selectedProject._count?.frames || 1}</p>
                  <p>动画帧</p>
                </div>
                <div className="bg-slate-50 rounded-lg py-1.5">
                  <p className="font-bold text-slate-700">{selectedProject._count?.favorites || 0}</p>
                  <p>收藏</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {isLoggedIn ? (
                  <button
                    id="gallery-fav-btn"
                    onClick={handleToggleFavorite}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      favorited
                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${favorited ? 'fill-rose-500' : ''}`} />
                    {favorited ? '已收藏' : '收藏'}
                  </button>
                ) : (
                  <a
                    href="/api/auth/login"
                    className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-slate-50 text-slate-500"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    登录后收藏
                  </a>
                )}
              </div>

              {/* Reviews Section */}
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5 mb-3">
                  <MessageCircle className="h-4 w-4 text-blue-500" />
                  <h4 className="text-xs font-bold text-slate-700">评价与评论 ({reviews.length})</h4>
                </div>

                {reviewsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
                ) : reviews.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-3">暂无评价，来写第一条吧</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                    {reviews.map((r) => (
                      <div key={r.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-600">
                            {r.author?.nickname || '匿名'}
                          </span>
                          {r.type === 'review' && r.score != null && renderStars(r.score)}
                        </div>
                        {r.content && <p className="text-[11px] text-slate-600 mt-1">{r.content}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Review Form */}
                {isLoggedIn ? (
                  <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
                    <div className="flex gap-2 items-center">
                      <select
                        value={reviewForm.type}
                        onChange={(e) => setReviewForm({ ...reviewForm, type: e.target.value as 'review' | 'comment' })}
                        className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg py-1 px-2 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="review">评分</option>
                        <option value="comment">评论</option>
                      </select>
                      {reviewForm.type === 'review' && (
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              key={s}
                              onClick={() => setReviewForm({ ...reviewForm, score: s })}
                              className={`text-sm cursor-pointer ${s <= reviewForm.score ? 'text-amber-500' : 'text-slate-300'}`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={reviewForm.content}
                        onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
                        placeholder="写下你的想法..."
                        className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1.5 text-xs rounded-lg focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        id="gallery-submit-review"
                        onClick={handleSubmitReview}
                        disabled={reviewSubmitting}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 rounded-lg text-xs disabled:opacity-60 transition-all cursor-pointer whitespace-nowrap"
                      >
                        {reviewSubmitting ? '...' : '发布'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 border-t border-slate-100 pt-3 text-center">
                    <a href="/api/auth/login" className="text-[11px] text-blue-600 hover:underline">
                      登录后可以评价和收藏
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};