-- Columns are defined in CREATE TABLE for fresh installs and managed by this migration for upgrades.
ALTER TABLE activitypub_reactions ADD COLUMN actor_name TEXT;
ALTER TABLE activitypub_reactions ADD COLUMN actor_url TEXT;
ALTER TABLE activitypub_reactions ADD COLUMN actor_icon_url TEXT;
