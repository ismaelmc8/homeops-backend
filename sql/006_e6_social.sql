-- E6 Social, feedback y retención
USE homeops;

ALTER TABLE homes
  ADD COLUMN social_mvp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN social_ranking_enabled TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE task_completions
  ADD COLUMN feedback_chip VARCHAR(32) NULL AFTER reward_breakdown,
  ADD COLUMN feedback_emoji VARCHAR(8) NULL AFTER feedback_chip,
  ADD COLUMN completion_tags JSON NULL AFTER feedback_emoji;

CREATE TABLE IF NOT EXISTS kudos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  from_user_id INT NOT NULL,
  to_user_id INT NOT NULL,
  completion_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (completion_id) REFERENCES task_completions(id) ON DELETE SET NULL,
  UNIQUE KEY uq_kudos_once (from_user_id, completion_id),
  INDEX idx_kudos_home (home_id, created_at DESC)
);

CREATE TABLE IF NOT EXISTS daily_preventive_bonus (
  user_id INT NOT NULL,
  bonus_date DATE NOT NULL,
  completion_id INT NOT NULL,
  coins_bonus INT NOT NULL DEFAULT 8,
  PRIMARY KEY (user_id, bonus_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (completion_id) REFERENCES task_completions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_micro_goals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  user_id INT NOT NULL,
  goal_date DATE NOT NULL,
  goal_type ENUM('micro_count', 'preventive_one') NOT NULL DEFAULT 'micro_count',
  target_value INT NOT NULL DEFAULT 2,
  progress_value INT NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  UNIQUE KEY uq_user_micro_goal (user_id, goal_date, goal_type),
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO meta_schema_version (version) VALUES ('006_e6');
