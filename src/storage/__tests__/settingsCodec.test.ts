// Pruebas del codec de ajustes (spec 005, T3). Puro: NO importa AsyncStorage
// ni React; solo transforma PomodoroSettings ⇄ JSON con validación campo por
// campo (enteros dentro de rango; dato inválido → null, RF-2). Patrón de
// sessionCodec.ts.

import { DEFAULT_SETTINGS, type PomodoroSettings } from '../../domain/settings';
import { parseStoredSettings, serializeSettings } from '../settingsCodec';

const PERSONALIZADOS: PomodoroSettings = {
  studyMinutes: 40,
  shortBreakMinutes: 10,
  longBreakMinutes: 20,
  pomodorosPerCycle: 2,
};

function conCampo(campo: keyof PomodoroSettings, valor: unknown): string {
  return JSON.stringify({ ...PERSONALIZADOS, [campo]: valor });
}

describe('settingsCodec — round-trip (RF-2)', () => {
  it('serialize → parse devuelve los mismos ajustes personalizados', () => {
    expect(parseStoredSettings(serializeSettings(PERSONALIZADOS))).toEqual(
      PERSONALIZADOS,
    );
  });

  it('round-trip de los ajustes por defecto 25/5/15/4', () => {
    expect(parseStoredSettings(serializeSettings(DEFAULT_SETTINGS))).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('acepta los límites de rango (60/30/60/10 y 1/1/1/1)', () => {
    const maximos: PomodoroSettings = {
      studyMinutes: 60,
      shortBreakMinutes: 30,
      longBreakMinutes: 60,
      pomodorosPerCycle: 10,
    };
    expect(parseStoredSettings(serializeSettings(maximos))).toEqual(maximos);

    const minimos: PomodoroSettings = {
      studyMinutes: 1,
      shortBreakMinutes: 1,
      longBreakMinutes: 1,
      pomodorosPerCycle: 1,
    };
    expect(parseStoredSettings(serializeSettings(minimos))).toEqual(minimos);
  });
});

describe('settingsCodec — validación y fallback a null (RF-2)', () => {
  it('null o cadena vacía → null (no hay ajustes guardados)', () => {
    expect(parseStoredSettings(null)).toBeNull();
    expect(parseStoredSettings('')).toBeNull();
  });

  it('JSON roto o que no es un objeto → null, sin lanzar excepción', () => {
    expect(parseStoredSettings('{ esto no es json')).toBeNull();
    expect(parseStoredSettings('undefined')).toBeNull();
    expect(parseStoredSettings('42')).toBeNull();
    expect(parseStoredSettings('"hola"')).toBeNull();
    expect(parseStoredSettings('[]')).toBeNull();
  });

  it('fuera de rango → null (70 min, 31 de descanso, 11 pomodoros, 0)', () => {
    expect(parseStoredSettings(conCampo('studyMinutes', 70))).toBeNull();
    expect(parseStoredSettings(conCampo('shortBreakMinutes', 31))).toBeNull();
    expect(parseStoredSettings(conCampo('longBreakMinutes', 61))).toBeNull();
    expect(parseStoredSettings(conCampo('pomodorosPerCycle', 11))).toBeNull();
    expect(parseStoredSettings(conCampo('studyMinutes', 0))).toBeNull();
  });

  it('no entero o no numérico → null, sin coercir (texto y decimales)', () => {
    expect(parseStoredSettings(conCampo('longBreakMinutes', 30.5))).toBeNull();
    expect(parseStoredSettings(conCampo('studyMinutes', '25'))).toBeNull();
    expect(parseStoredSettings(conCampo('pomodorosPerCycle', '4'))).toBeNull();
    expect(parseStoredSettings(conCampo('studyMinutes', -5))).toBeNull();
    expect(parseStoredSettings(conCampo('studyMinutes', null))).toBeNull();
    expect(parseStoredSettings(conCampo('studyMinutes', true))).toBeNull();
  });

  it('campo ausente → null (ajustes incompletos)', () => {
    const incompleto = JSON.parse(serializeSettings(PERSONALIZADOS));
    delete incompleto.pomodorosPerCycle;
    expect(parseStoredSettings(JSON.stringify(incompleto))).toBeNull();
  });

  it('claves extra se ignoran: solo se leen los 4 campos conocidos', () => {
    const conExtra = JSON.stringify({ ...PERSONALIZADOS, tema: 'oscuro' });
    expect(parseStoredSettings(conExtra)).toEqual(PERSONALIZADOS);
  });
});
