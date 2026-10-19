// Pruebas de la lógica pura de ajustes (spec 005, T1): valores por defecto,
// rangos, validación con mensajes en español que citan el rango, hints bajo
// campo y conversión al config del ciclo. Sin React, sin AsyncStorage, sin
// mocks y sin reloj interno (principio 3).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEFAULT_SETTINGS,
  SETTINGS_RANGES,
  formatRangeHint,
  settingsToConfig,
  validateSettings,
  validateSettingsField,
} from '../settings';

const MINUTE = 60 * 1000;

describe('DEFAULT_SETTINGS (RF-9)', () => {
  it('son 25/5/15/4, derivados de las constantes existentes', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      studyMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      pomodorosPerCycle: 4,
    });
  });
});

describe('SETTINGS_RANGES (RF-10)', () => {
  it('declara 1–60 estudio, 1–30 corto, 1–60 largo y 1–10 pomodoros', () => {
    expect(SETTINGS_RANGES).toEqual({
      studyMinutes: { min: 1, max: 60 },
      shortBreakMinutes: { min: 1, max: 30 },
      longBreakMinutes: { min: 1, max: 60 },
      pomodorosPerCycle: { min: 1, max: 10 },
    });
  });
});

describe('formatRangeHint (RF-11)', () => {
  it('devuelve los 4 hints con la unidad correcta', () => {
    expect(formatRangeHint('studyMinutes')).toBe('1–60 min');
    expect(formatRangeHint('shortBreakMinutes')).toBe('1–30 min');
    expect(formatRangeHint('longBreakMinutes')).toBe('1–60 min');
    expect(formatRangeHint('pomodorosPerCycle')).toBe('1–10');
  });
});

describe('validateSettingsField (RF-10, RF-12)', () => {
  it('vacío → error que cita el rango del campo', () => {
    expect(validateSettingsField('studyMinutes', '')).toBe(
      'Escribe un valor. Puedes usar 1–60 min.',
    );
    expect(validateSettingsField('pomodorosPerCycle', '')).toBe(
      'Escribe un valor. Puedes usar 1–10.',
    );
  });

  it("'0', '-5' y '30.5' → error con el rango en el mensaje", () => {
    const cero = validateSettingsField('studyMinutes', '0');
    expect(cero).toBe('Usa un valor entre 1 y 60.');
    expect(cero).toContain('60');

    expect(validateSettingsField('studyMinutes', '-5')).toBe(
      'Solo se admiten números enteros. Usa 1–60 min.',
    );
    expect(validateSettingsField('studyMinutes', '30.5')).toBe(
      'Solo se admiten números enteros. Usa 1–60 min.',
    );
    expect(validateSettingsField('shortBreakMinutes', 'veinte')).toBe(
      'Solo se admiten números enteros. Usa 1–30 min.',
    );
  });

  it("por encima del máximo ('61' / '31' / '61' / '11') → error con el rango", () => {
    expect(validateSettingsField('studyMinutes', '61')).toBe(
      'Usa un valor entre 1 y 60.',
    );
    expect(validateSettingsField('shortBreakMinutes', '31')).toBe(
      'Usa un valor entre 1 y 30.',
    );
    expect(validateSettingsField('longBreakMinutes', '61')).toBe(
      'Usa un valor entre 1 y 60.',
    );
    expect(validateSettingsField('pomodorosPerCycle', '11')).toBe(
      'Usa un valor entre 1 y 10.',
    );
  });

  it('los límites mismos y los mínimos → null (válido)', () => {
    expect(validateSettingsField('studyMinutes', '60')).toBeNull();
    expect(validateSettingsField('shortBreakMinutes', '30')).toBeNull();
    expect(validateSettingsField('longBreakMinutes', '60')).toBeNull();
    expect(validateSettingsField('pomodorosPerCycle', '10')).toBeNull();
    expect(validateSettingsField('studyMinutes', '1')).toBeNull();
    expect(validateSettingsField('shortBreakMinutes', '1')).toBeNull();
    expect(validateSettingsField('longBreakMinutes', '1')).toBeNull();
    expect(validateSettingsField('pomodorosPerCycle', '1')).toBeNull();
    expect(validateSettingsField('studyMinutes', '25')).toBeNull();
  });
});

describe('validateSettings (RF-10: todo o nada)', () => {
  const valido = {
    studyMinutes: '25',
    shortBreakMinutes: '5',
    longBreakMinutes: '15',
    pomodorosPerCycle: '4',
  };

  it('formulario válido → {}', () => {
    expect(validateSettings(valido)).toEqual({});
  });

  it('1 campo mal → el error solo en ese campo', () => {
    const errores = validateSettings({ ...valido, shortBreakMinutes: '31' });
    expect(errores).toEqual({
      shortBreakMinutes: 'Usa un valor entre 1 y 30.',
    });
  });

  it('campo vacío → error solo en ese campo', () => {
    const errores = validateSettings({ ...valido, pomodorosPerCycle: '' });
    expect(errores).toEqual({
      pomodorosPerCycle: 'Escribe un valor. Puedes usar 1–10.',
    });
  });
});

describe('settingsToConfig (RF-1, RF-8, RF-9)', () => {
  it('convierte los minutos a ms por fase y lleva pomodorosPerCycle', () => {
    expect(
      settingsToConfig({
        studyMinutes: 40,
        shortBreakMinutes: 10,
        longBreakMinutes: 20,
        pomodorosPerCycle: 3,
      }),
    ).toEqual({
      durationsMs: {
        study: 40 * MINUTE,
        shortBreak: 10 * MINUTE,
        longBreak: 20 * MINUTE,
      },
      pomodorosPerCycle: 3,
    });
  });

  it('los defaults producen la config por defecto 25/5/15/4', () => {
    expect(settingsToConfig(DEFAULT_SETTINGS)).toEqual({
      durationsMs: {
        study: 25 * MINUTE,
        shortBreak: 5 * MINUTE,
        longBreak: 15 * MINUTE,
      },
      pomodorosPerCycle: 4,
    });
  });
});

describe('pureza del módulo (principio 3)', () => {
  it('no importa React, AsyncStorage ni usa el reloj del sistema', () => {
    const fuente = readFileSync(join(__dirname, '..', 'settings.ts'), 'utf8');
    expect(fuente).not.toMatch(/from 'react'/);
    expect(fuente).not.toMatch(/@react-native-async-storage/);
    expect(fuente).not.toMatch(/Date\.now/);
  });
});
