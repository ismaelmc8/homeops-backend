-- E4 Hogar compartido: cooperación, eventos, objetivos, asignación
USE homeops;

ALTER TABLE tasks
  ADD COLUMN is_cooperative TINYINT(1) NOT NULL DEFAULT 0 AFTER is_micro;

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (task_id, user_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_coop_cycles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  window_hours INT NOT NULL DEFAULT 48,
  closed_at DATETIME NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  INDEX idx_coop_cycle_task (task_id, closed_at)
);

CREATE TABLE IF NOT EXISTS task_coop_participants (
  cycle_id INT NOT NULL,
  user_id INT NOT NULL,
  completion_id INT NOT NULL,
  coop_bonus_coins INT NOT NULL DEFAULT 0,
  PRIMARY KEY (cycle_id, user_id),
  FOREIGN KEY (cycle_id) REFERENCES task_coop_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY (completion_id) REFERENCES task_completions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS home_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  event_type ENUM('speedrun', 'perfect_day') NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_home_events_active (home_id, starts_at, ends_at)
);

CREATE TABLE IF NOT EXISTS home_weekly_goals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  week_start DATE NOT NULL,
  goal_type ENUM('zero_critical_zones', 'completions_count') NOT NULL,
  target_value INT NOT NULL DEFAULT 5,
  reward_coins INT NOT NULL DEFAULT 50,
  claimed_at DATETIME NULL,
  UNIQUE KEY uq_home_week_goal (home_id, week_start, goal_type),
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

ALTER TABLE task_completions
  ADD COLUMN coop_bonus_coins INT NOT NULL DEFAULT 0 AFTER coins_earned;

ALTER TABLE activation_tokens
  ADD COLUMN purpose ENUM('activation', 'reset') NOT NULL DEFAULT 'activation' AFTER user_id;

INSERT INTO meta_schema_version (version) VALUES ('005_e4');
