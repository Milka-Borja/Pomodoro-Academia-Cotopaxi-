// Lógica pura de los ajustes del Pomodoro (spec 005, T1): valores por defecto,
// rangos permitidos, validación de campo con mensajes en español que siempre
// citan el rango, hint bajo campo y conversión al config que entiende
// src/domain/cycle.ts. Sin React, sin AsyncStorage y sin reloj interno
// (principio 3: aquí solo viven datos y funciones puras).

import {
  DEFAULT_LONG_BREAK_DURATION_MS,
  DEFAULT_SHORT_BREAK_DURATION_MS,
  POMODOROS_PER_CYCLE,
  type Phase,
} from './cycle';
import { DEFAULT_STUDY_DURATION_MS } from './timer';

/** Campos editables en la pantalla de ajustes (spec 005). */
export type SettingsField =
  | 'studyMinutes'
  | 'shortBreakMinutes'
  | 'longBreakMinutes'
  | 'pomodorosPerCycle';

/** Valores guardados de los ajustes, siempre enteros en su rango. */
export interface PomodoroSettings {
  studyMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  pomodorosPerCycle: number;
}

/** Rango permitido por campo (RF-10): estudio 1–60, corto 1–30, largo 1–60, pomodoros 1–10. */
export const SETTINGS_RANGES: Record<
  SettingsField,
  { min: number; max: number }
> = {
  studyMinutes: { min: 1, max: 60 },
  shortBreakMinutes: { min: 1, max: 30 },
  longBreakMinutes: { min: 1, max: 60 },
  pomodorosPerCycle: { min: 1, max: 10 },
};

/**
 * Ajustes por defecto de la técnica: 25/5/15/4. Derivados de las constantes
 * existentes para que haya una única fuente de verdad (RF-1, RF-8, RF-9).
 */
export const DEFAULT_SETTINGS: PomodoroSettings = {
  studyMinutes: DEFAULT_STUDY_DURATION_MS / 60_000,
  shortBreakMinutes: DEFAULT_SHORT_BREAK_DURATION_MS / 60_000,
  longBreakMinutes: DEFAULT_LONG_BREAK_DURATION_MS / 60_000,
  pomodorosPerCycle: POMODOROS_PER_CYCLE,
};

const SETTINGS_FIELDS: readonly SettingsField[] = [
  'studyMinutes',
  'shortBreakMinutes',
  'longBreakMinutes',
  'pomodorosPerCycle',
];

/**
 * Texto del rango para mostrar SIEMPRE bajo el campo, antes de que el usuario
 * se equivoque (RF-11): «1–60 min», «1–30 min», «1–60 min», «1–10».
 */
export function formatRangeHint(campo: SettingsField): string {
  const { min, max } = SETTINGS_RANGES[campo];
  const unidad = campo === 'pomodorosPerCycle' ? '' : ' min';
  return `${min}–${max}${unidad}`;
}

/**
 * Valida un campo del formulario. Devuelve `null` si es válido o, si no, un
 * mensaje en español que SIEMPRE cita el rango permitido (RF-10, HU-005
 * Escenario 2). Solo se admiten dígitos: sin vacíos, sin cero, sin negativos
 * ni decimales como tiempo válido (RF-12).
 */
export function validateSettingsField(
  campo: SettingsField,
  texto: string,
): string | null {
  const rango = formatRangeHint(campo);
  if (texto === '') return `Escribe un valor. Puedes usar ${rango}.`;
  if (!/^\d+$/.test(texto)) {
    return `Solo se admiten números enteros. Usa ${rango}.`;
  }
  const valor = Number(texto);
  const { min, max } = SETTINGS_RANGES[campo];
  if (valor < min || valor > max) return `Usa un valor entre ${min} y ${max}.`;
  return null;
}

/**
 * Valida el formulario completo. Devuelve el mapa de errores por campo, vacío
 * si todo es válido: la pantalla solo persiste cuando queda vacío (todo o
 * nada, RF-10).
 */
export function validateSettings(
  form: Record<SettingsField, string>,
): Partial<Record<SettingsField, string>> {
  const errores: Partial<Record<SettingsField, string>> = {};
  for (const campo of SETTINGS_FIELDS) {
    const mensaje = validateSettingsField(campo, form[campo]);
    if (mensaje !== null) errores[campo] = mensaje;
  }
  return errores;
}

/**
 * Convierte los ajustes al config que consume `src/domain/cycle.ts` (ms por
 * fase + tamaño del ciclo). Misma forma estructural que `PomodoroConfig`:
 * TypeScript lo acepta por tipado estructural sin importar el tipo.
 */
export function settingsToConfig(settings: PomodoroSettings): {
  durationsMs: Record<Phase, number>;
  pomodorosPerCycle: number;
} {
  const minuto = 60_000;
  return {
    durationsMs: {
      study: settings.studyMinutes * minuto,
      shortBreak: settings.shortBreakMinutes * minuto,
      longBreak: settings.longBreakMinutes * minuto,
    },
    pomodorosPerCycle: settings.pomodorosPerCycle,
  };
}
