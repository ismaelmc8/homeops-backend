-- Permite activar/desactivar el sistema de fatiga por hogar
USE homeops;

ALTER TABLE home_smart_settings
  ADD COLUMN fatigue_enabled TINYINT(1) NOT NULL DEFAULT 1;

INSERT INTO meta_schema_version (version) VALUES ('013_fatigue');
