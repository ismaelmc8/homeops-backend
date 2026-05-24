-- E2 Gamificación núcleo: rachas, fatiga, duración real
USE homeops;

CREATE TABLE IF NOT EXISTS streaks (
  user_id INT NOT NULL,
  task_id INT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, task_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_fatigue (
  user_id INT NOT NULL,
  fatigue_date DATE NOT NULL,
  points INT NOT NULL DEFAULT 0,
  warned TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, fatigue_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE task_completions
  ADD COLUMN duration_actual INT NULL AFTER xp_earned,
  ADD COLUMN reward_breakdown JSON NULL AFTER duration_actual;

INSERT INTO meta_schema_version (version) VALUES ('003_e2');
