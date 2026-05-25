-- E9 Smart: settings, notificaciones in-app, preferencias usuario
USE homeops;

CREATE TABLE IF NOT EXISTS home_smart_settings (
  home_id INT PRIMARY KEY,
  silence_mode TINYINT(1) NOT NULL DEFAULT 0,
  notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
  predictions_enabled TINYINT(1) NOT NULL DEFAULT 1,
  next_task_enabled TINYINT(1) NOT NULL DEFAULT 1,
  auto_priority_enabled TINYINT(1) NOT NULL DEFAULT 1,
  optimal_hours_enabled TINYINT(1) NOT NULL DEFAULT 1,
  burnout_guard_enabled TINYINT(1) NOT NULL DEFAULT 1,
  assignee_suggestions_enabled TINYINT(1) NOT NULL DEFAULT 1,
  quiet_hours_start TINYINT NOT NULL DEFAULT 22,
  quiet_hours_end TINYINT NOT NULL DEFAULT 8,
  daily_notification_cap INT NOT NULL DEFAULT 3,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_smart_prefs (
  user_id INT PRIMARY KEY,
  low_energy_mode TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS smart_notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  user_id INT NULL,
  kind VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_smart_notif_home (home_id, created_at DESC)
);

CREATE TABLE IF NOT EXISTS smart_notification_daily (
  home_id INT NOT NULL,
  user_id INT NOT NULL,
  day DATE NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (home_id, user_id, day),
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO meta_schema_version (version) VALUES ('009_e9');
