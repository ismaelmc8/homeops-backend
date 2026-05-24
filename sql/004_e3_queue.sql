-- E3 Cola y prioridad: actividad del usuario
USE homeops;

ALTER TABLE users
  ADD COLUMN last_active_at DATETIME NULL AFTER created_at;

INSERT INTO meta_schema_version (version) VALUES ('004_e3');
