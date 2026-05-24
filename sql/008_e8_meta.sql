-- E8 Meta-juego: misiones diarias, boss, temporadas, base viva
USE homeops;

ALTER TABLE home_events
  MODIFY COLUMN event_type ENUM(
    'speedrun', 'perfect_day', 'daily_mission', 'random_bonus', 'boss_window'
  ) NOT NULL;

ALTER TABLE home_weekly_goals
  MODIFY COLUMN goal_type ENUM(
    'zero_critical_zones', 'completions_count', 'coop_completions_count', 'micro_completions_count'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS home_meta_settings (
  home_id INT PRIMARY KEY,
  random_events_enabled TINYINT(1) NOT NULL DEFAULT 1,
  base_buff_coins_pct TINYINT NOT NULL DEFAULT 0,
  base_state VARCHAR(24) NOT NULL DEFAULT 'stable',
  recovery_started_at DATETIME NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS home_daily_missions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  mission_date DATE NOT NULL,
  mission_key VARCHAR(40) NOT NULL,
  target_value INT NOT NULL DEFAULT 1,
  progress INT NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  UNIQUE KEY uq_home_daily_mission (home_id, mission_date),
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS home_boss_missions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  zone_id INT NOT NULL,
  task_id INT NULL,
  status ENUM('active', 'completed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  INDEX idx_boss_active (home_id, status)
);

CREATE TABLE IF NOT EXISTS home_season_progress (
  home_id INT NOT NULL,
  season_key VARCHAR(32) NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (home_id, season_key),
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

ALTER TABLE tasks
  ADD COLUMN is_boss TINYINT(1) NOT NULL DEFAULT 0 AFTER is_cooperative;

INSERT INTO meta_schema_version (version) VALUES ('008_e8');
