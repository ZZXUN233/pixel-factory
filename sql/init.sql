-- Pixel Factory Database Init
-- Run: mysql -u root -p < sql/init.sql

CREATE DATABASE IF NOT EXISTS \`pixel-factory\`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE \`pixel-factory\`;

-- ============================================================
-- projects
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id             VARCHAR(32)  NOT NULL PRIMARY KEY,
  auth_center_id VARCHAR(32)  NOT NULL,
  name           VARCHAR(128) NOT NULL,
  width          INT          NOT NULL,
  height         INT          NOT NULL,
  palette        TEXT         NOT NULL COMMENT 'JSON array of hex color strings',
  rle            TEXT         NOT NULL COMMENT 'Run-length encoded pixel data',
  category       VARCHAR(64)  DEFAULT NULL,
  description    TEXT         DEFAULT NULL,
  is_public      TINYINT(1)   NOT NULL DEFAULT 0,
  avg_score      FLOAT        DEFAULT 0,
  review_count   INT          DEFAULT 0,
  created_at     BIGINT       NOT NULL,
  updated_at     BIGINT       NOT NULL,
  INDEX idx_projects_auth_center_id (auth_center_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- animation_frames
-- ============================================================
CREATE TABLE IF NOT EXISTS animation_frames (
  id          VARCHAR(32) NOT NULL PRIMARY KEY,
  project_id  VARCHAR(32) NOT NULL,
  frame_index INT         NOT NULL,
  rle         TEXT        NOT NULL COMMENT 'Per-row RLE (JSON array of strings)',
  created_at  BIGINT      NOT NULL,
  UNIQUE KEY uk_project_frame (project_id, frame_index),
  CONSTRAINT fk_animation_frames_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- users_cache
-- ============================================================
CREATE TABLE IF NOT EXISTS users_cache (
  auth_center_id VARCHAR(32)  NOT NULL PRIMARY KEY,
  nickname       VARCHAR(64)  DEFAULT NULL,
  avatar_url     VARCHAR(512) DEFAULT NULL,
  last_synced_at BIGINT       NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- project_reviews — 评价与评论
-- ============================================================
CREATE TABLE IF NOT EXISTS project_reviews (
  id             VARCHAR(32) NOT NULL PRIMARY KEY,
  project_id     VARCHAR(32) NOT NULL,
  auth_center_id VARCHAR(32) NOT NULL,
  type           VARCHAR(8)  NOT NULL DEFAULT 'review' COMMENT '"review" | "comment"',
  content        TEXT,
  score          INT         DEFAULT NULL COMMENT '1-10 (0-5星×2)，仅 review 有',
  status         VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT 'active / deleted',
  created_at     BIGINT      NOT NULL,
  updated_at     BIGINT      NOT NULL,
  INDEX idx_reviews_project (project_id, type, status),
  CONSTRAINT fk_reviews_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- project_favorites — 收藏
-- ============================================================
CREATE TABLE IF NOT EXISTS project_favorites (
  id             VARCHAR(32) NOT NULL PRIMARY KEY,
  project_id     VARCHAR(32) NOT NULL,
  auth_center_id VARCHAR(32) NOT NULL,
  created_at     BIGINT      NOT NULL,
  UNIQUE KEY uk_fav_project_user (project_id, auth_center_id),
  CONSTRAINT fk_favorites_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;