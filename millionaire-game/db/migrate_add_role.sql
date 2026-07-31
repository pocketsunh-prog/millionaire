-- Migration: Add role column to users table
-- Run this if you already have the database set up before the admin feature was added.
-- Docker users: rebuild the container with `docker-compose down -v && docker-compose up -d`
-- to re-run schema.sql from scratch, or execute this SQL manually.

USE millionaire;

-- Add role column if it doesn't exist
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'millionaire'
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'role'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN role ENUM(''user'', ''admin'') DEFAULT ''user'' AFTER avatar',
  'SELECT ''role column already exists'' as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index on role if it doesn't exist
SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'millionaire'
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_role'
);

SET @idx_sql = IF(@idx_exists = 0,
  'ALTER TABLE users ADD INDEX idx_role (role)',
  'SELECT ''idx_role index already exists'' as message'
);

PREPARE idx_stmt FROM @idx_sql;
EXECUTE idx_stmt;
DEALLOCATE PREPARE idx_stmt;
