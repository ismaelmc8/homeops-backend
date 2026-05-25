/** E5 — Niveles, rangos, especializaciones, logros (sin pay-to-win). */

export const SPEC_COOLDOWN_DAYS = 7;

export const SPECIALIZATIONS = [
  {
    key: "speedrunner",
    label: "Speedrunner",
    hint: "+eficiencia en tareas ≤ 10 min",
  },
  {
    key: "preventive",
    label: "Preventivo",
    hint: "+bonus en zonas 0–2",
  },
  {
    key: "cooperative",
    label: "Cooperativo",
    hint: "+bonus en tareas grupales",
  },
  {
    key: "deep",
    label: "Limpieza profunda",
    hint: "+XP en profundas si zona ≤ 2 (no grind)",
  },
  {
    key: "organizer",
    label: "Organizador",
    hint: "+prioridad visible en tareas «Hoy»",
  },
];

export const LEVEL_THRESHOLDS = [
  0, 50, 120, 220, 350, 520, 750, 1050, 1400, 1800, 2300,
];

export const RANKS = [
  { minLevel: 1, key: "apprentice", label: "Aprendiz del hogar" },
  { minLevel: 3, key: "keeper", label: "Guardián del orden" },
  { minLevel: 5, key: "balancer", label: "Equilibrista doméstico" },
  { minLevel: 7, key: "master", label: "Mantenimiento maestro" },
  { minLevel: 10, key: "legend", label: "Leyenda del equilibrio" },
];

export const TITLES = [
  { key: "title_streak_7", label: "Constante", unlockAchievement: "streak_7" },
  { key: "title_preventive", label: "Preventivo nato", unlockAchievement: "preventive_10" },
  { key: "title_coop", label: "Espíritu de equipo", unlockAchievement: "coop_5" },
  { key: "title_micro", label: "Maestro del micro", unlockAchievement: "micro_20" },
];

export const ACHIEVEMENT_DEFS = [
  { key: "streak_7", label: "Racha de 7 en una tarea", description: "Mantén una racha de 7." },
  { key: "streak_30", label: "Racha legendaria", description: "Racha de 30 en una tarea." },
  { key: "preventive_10", label: "Diez preventivas", description: "10 tareas con zona ≤1." },
  { key: "coop_5", label: "Cooperador", description: "5 tareas cooperativas con bonus." },
  { key: "micro_20", label: "Microexperto", description: "20 microtareas completadas." },
  { key: "no_critical_week", label: "Semana estable", description: "7 días sin zonas en crítico." },
];

export const STATS_LABELS = {
  order: "Orden",
  technique: "Técnica",
  endurance: "Resistencia",
  speed: "Velocidad",
  cooperation: "Cooperación",
};
