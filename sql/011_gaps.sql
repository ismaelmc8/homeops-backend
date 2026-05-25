-- Huecos E1/E4/E7/E8: eventos extra, retos semanales admin, revocar sesiones vía token_version
USE homeops;

ALTER TABLE home_events
  MODIFY COLUMN event_type ENUM(
    'speedrun', 'perfect_day', 'daily_mission', 'random_bonus', 'boss_window',
    'cooperative_day', 'combo_rooms', 'master_maintenance'
  ) NOT NULL;

ALTER TABLE home_weekly_goals
  ADD COLUMN custom_label VARCHAR(200) NULL AFTER goal_type,
  ADD COLUMN set_by_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER custom_label;

INSERT INTO meta_schema_version (version) VALUES ('011_gaps');
