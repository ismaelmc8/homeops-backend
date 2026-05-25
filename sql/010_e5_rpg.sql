-- E5 RPG: niveles, logros, especializaciones, calidad, tienda buffs/cosméticos
USE homeops;

ALTER TABLE task_completions
  ADD COLUMN quality_rating TINYINT NULL AFTER completion_tags;

ALTER TABLE users
  ADD COLUMN token_version INT NOT NULL DEFAULT 0 AFTER xp;

CREATE TABLE IF NOT EXISTS user_rpg_prefs (
  user_id INT PRIMARY KEY,
  specialization VARCHAR(32) NULL,
  specialization_changed_at DATETIME NULL,
  equipped_title_key VARCHAR(64) NULL,
  equipped_cosmetic_key VARCHAR(64) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INT NOT NULL,
  achievement_key VARCHAR(64) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, achievement_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rpg_shop_items (
  item_key VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NOT NULL,
  cost_coins INT NOT NULL,
  item_type ENUM('buff', 'cosmetic') NOT NULL,
  buff_kind VARCHAR(32) NULL,
  buff_multiplier DECIMAL(4,2) NULL,
  duration_hours INT NULL,
  cosmetic_kind VARCHAR(32) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_active_buffs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  buff_key VARCHAR(64) NOT NULL,
  multiplier DECIMAL(4,2) NOT NULL DEFAULT 1,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_buff_active (user_id, expires_at)
);

CREATE TABLE IF NOT EXISTS user_cosmetics_owned (
  user_id INT NOT NULL,
  cosmetic_key VARCHAR(64) NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, cosmetic_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO rpg_shop_items (item_key, name, description, cost_coins, item_type, buff_kind, buff_multiplier, duration_hours) VALUES
  ('buff_quiet_hour', 'Hora tranquila', '−25% fatiga acumulada (efecto suave en recompensas)', 80, 'buff', 'fatigue_soft', 1, 24),
  ('buff_duo', 'Dúo eficiente', '+15% bonus cooperación', 100, 'buff', 'coop', 1.15, 24),
  ('buff_quality_eye', 'Ojo de águila', '+10% bonus calidad en 3 tareas', 60, 'buff', 'quality', 1.1, 72)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO rpg_shop_items (item_key, name, description, cost_coins, item_type, cosmetic_kind) VALUES
  ('cosmetic_frame_green', 'Marco verde', 'Marco de perfil hogar radiante', 120, 'cosmetic', 'profile_frame'),
  ('cosmetic_theme_spring', 'Tema primavera', 'Acentos verdes suaves en la app', 150, 'cosmetic', 'theme')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO meta_schema_version (version) VALUES ('010_e5');
