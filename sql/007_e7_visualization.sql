-- E7 Visualización: mapa, posponer, plantillas
USE homeops;

ALTER TABLE zones
  ADD COLUMN grid_col TINYINT NOT NULL DEFAULT 0 AFTER daily_increment,
  ADD COLUMN grid_row TINYINT NOT NULL DEFAULT 0 AFTER grid_col,
  ADD COLUMN map_icon VARCHAR(16) NULL AFTER grid_row;

ALTER TABLE tasks
  ADD COLUMN snoozed_until DATETIME NULL AFTER last_completed_at;

CREATE TABLE IF NOT EXISTS task_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  home_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  zone_id INT NULL,
  task_type ENUM('recurrent_light', 'recurrent_heavy', 'deep', 'eventual', 'micro') NOT NULL DEFAULT 'recurrent_light',
  difficulty TINYINT NOT NULL DEFAULT 2,
  duration_min INT NOT NULL DEFAULT 15,
  frequency_ideal_days INT NOT NULL DEFAULT 2,
  frequency_tolerance_days INT NOT NULL DEFAULT 1,
  frequency_critical_days INT NOT NULL DEFAULT 3,
  dirt_reduction TINYINT NOT NULL DEFAULT 2,
  is_micro TINYINT(1) NOT NULL DEFAULT 0,
  is_cooperative TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL
);
