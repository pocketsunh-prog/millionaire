-- Migration: add `enabled` flag to categories so a category can be disabled
-- and hidden from the game without deleting it (or its questions).
--
-- Default 1 (enabled) so every existing category stays playable. Run once:
--   mysql -u <user> -p <dbname> < db/migrate_add_category_enabled.sql
-- Docker users: the container re-runs schema.sql only on a fresh volume; on an
-- existing database execute this file manually against the running container:
--   docker exec -i <container> mysql -u root -p millionaire < db/migrate_add_category_enabled.sql

USE millionaire;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'millionaire'
    AND TABLE_NAME = 'categories'
    AND COLUMN_NAME = 'enabled'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE categories ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER description',
  'SELECT ''enabled column already exists'' as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
