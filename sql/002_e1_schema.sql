-- E1 MVP schema (ejecutar tras 001_init.sql)
USE homeops;

CREATE TABLE IF NOT EXISTS homes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  last_deterioration_at DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NULL,
  role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  status ENUM('pending', 'active') NOT NULL DEFAULT 'pending',
  xp INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activation_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_activation_token_hash (token_hash)
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id INT PRIMARY KEY,
  coins INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS zones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  dirt_level TINYINT NOT NULL DEFAULT 1,
  daily_increment DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  zone_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  task_type ENUM('recurrent_light', 'recurrent_heavy', 'deep', 'eventual', 'micro') NOT NULL,
  difficulty TINYINT NOT NULL DEFAULT 2,
  duration_min INT NOT NULL DEFAULT 15,
  frequency_ideal_days INT NOT NULL DEFAULT 2,
  frequency_tolerance_days INT NOT NULL DEFAULT 1,
  frequency_critical_days INT NOT NULL DEFAULT 3,
  dirt_reduction TINYINT NOT NULL DEFAULT 2,
  is_micro TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_completions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  zone_dirt_at_completion TINYINT NOT NULL,
  coins_earned INT NOT NULL,
  xp_earned INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rewards (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  cost_coins INT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  reward_id INT NOT NULL,
  reward_name VARCHAR(200) NOT NULL,
  coins_spent INT NOT NULL,
  redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE RESTRICT,
  INDEX idx_redemptions_user (user_id, redeemed_at DESC)
);


INSERT INTO meta_schema_version (version) VALUES ('002_e1');
