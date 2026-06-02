-- Calificación entre miembros (post-completado, no quien hizo la tarea)
USE homeops;

CREATE TABLE IF NOT EXISTS completion_peer_ratings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  completion_id INT NOT NULL,
  rater_user_id INT NOT NULL,
  rating TINYINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (completion_id) REFERENCES task_completions(id) ON DELETE CASCADE,
  FOREIGN KEY (rater_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_peer_rating_once (completion_id, rater_user_id),
  CHECK (rating >= 1 AND rating <= 5),
  INDEX idx_peer_rater (rater_user_id, created_at DESC)
);

INSERT INTO meta_schema_version (version) VALUES ('012_peer_ratings');
