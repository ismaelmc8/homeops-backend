/** E9 — Umbrales del motor smart (reglas, no ML externo). */

export const MIN_COMPLETIONS_FOR_PREDICTION = 5;
export const PREDICTION_HISTORY_DAYS = 14;
export const OPTIMAL_HOURS_HISTORY_DAYS = 14;
export const BURNOUT_LOOKBACK_DAYS = 3;

export const BURNOUT_FATIGUE_THRESHOLD = 6;
export const BURNOUT_SLOW_RATIO = 1.3;
export const BURNOUT_COLUMN_LIMIT = 3;
export const DEFAULT_COLUMN_LIMIT = 5;

export const SMART_AUTOMATIONS = [
  { key: "notificationsEnabled", label: "Notificaciones inteligentes" },
  { key: "predictionsEnabled", label: "Predicción de suciedad" },
  { key: "nextTaskEnabled", label: "Siguiente mejor tarea" },
  { key: "autoPriorityEnabled", label: "Prioridad automática (Kanban)" },
  { key: "optimalHoursEnabled", label: "Horarios óptimos" },
  { key: "burnoutGuardEnabled", label: "Guardia anti-burnout" },
  { key: "assigneeSuggestionsEnabled", label: "Sugerencia de reparto" },
  { key: "silenceMode", label: "Modo silencio (0 notificaciones)" },
];
