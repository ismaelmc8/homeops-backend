/** E8 — Meta-juego: reglas del motor de eventos y base viva. */

export const MAX_STACKED_BONUS_EVENTS = 2;
export const RANDOM_EVENT_CHANCE = 0.22;
export const RANDOM_EVENT_HOURS = 4;
export const RANDOM_EVENT_MULTIPLIER = 1.15;

export const BOSS_REWARD_COINS = 35;
export const BOSS_RESTORE_DIRT_LEVEL = 2;
export const BOSS_TASK_DURATION_MIN = 45;

/** Buff de monedas por estado de base viva (preventivo > grind boss a largo plazo). */
export const BASE_BUFF_BY_STATE = {
  radiant: 10,
  stable: 5,
  attention: 0,
  recovery: 0,
};

export const BASE_STATE_LABELS = {
  radiant: "Hogar radiante",
  stable: "Hogar estable",
  attention: "Necesita atención",
  recovery: "Modo recuperación",
};

export const DAILY_MISSIONS = [
  {
    key: "micro_2",
    label: "Completa 2 microtareas hoy",
    target: 2,
    type: "micro",
  },
  {
    key: "micro_3",
    label: "Completa 3 microtareas hoy",
    target: 3,
    type: "micro",
  },
  {
    key: "coop_1",
    label: "Completa 1 tarea cooperativa hoy",
    target: 1,
    type: "coop",
  },
  {
    key: "preventive_2",
    label: "2 tareas con zona en verde (≤1) al completar",
    target: 2,
    type: "preventive",
  },
];

export const WEEKLY_GOAL_ROTATION = [
  { goalType: "completions_count", target: 10, reward: 50 },
  { goalType: "zero_critical_zones", target: 1, reward: 60 },
  { goalType: "coop_completions_count", target: 3, reward: 55 },
  { goalType: "micro_completions_count", target: 8, reward: 45 },
];

/** Temporadas de 5 semanas; cosmético, sin reset de progreso. */
export const SEASON_THEMES = [
  { key: "spring_fresh", name: "Primavera fresca", emoji: "🌸", weeks: 5 },
  { key: "summer_breeze", name: "Brisa veraniega", emoji: "☀️", weeks: 5 },
  { key: "autumn_cozy", name: "Otoño acogedor", emoji: "🍂", weeks: 5 },
  { key: "winter_calm", name: "Invierno tranquilo", emoji: "❄️", weeks: 5 },
];

export const SEASON_EPOCH = new Date("2026-01-06T00:00:00Z");
export const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export const RECOVERY_MICRO_PER_DAY = 3;
export const RECOVERY_MIN_DAYS = 3;
export const RECOVERY_MAX_DAYS = 7;
