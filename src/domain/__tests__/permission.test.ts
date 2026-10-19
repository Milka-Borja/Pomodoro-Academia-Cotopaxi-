// Pruebas de la matriz del flujo de permiso de notificaciones (spec 004).
// Lógica pura: sin mocks, sin React ni AsyncStorage (principio 3).

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  resolveExactAlarmInvitationAction,
  resolveNotificationPermissionAction,
} from '../permission';

describe('resolveNotificationPermissionAction', () => {
  it('con notificaciones habilitadas devuelve start: arranca directo sin diálogos (RF-10)', () => {
    expect(
      resolveNotificationPermissionAction({ enabled: true, asked: false, informed: false }),
    ).toBe('start');
    // el resto de la matriz no cambia el resultado: si está habilitado, arranca
    expect(
      resolveNotificationPermissionAction({ enabled: true, asked: true, informed: false }),
    ).toBe('start');
    expect(
      resolveNotificationPermissionAction({ enabled: true, asked: true, informed: true }),
    ).toBe('start');
  });

  it('sin habilitar y sin haber pedido nunca devuelve explain: primera vez, se explica antes de pedir (RF-10)', () => {
    expect(
      resolveNotificationPermissionAction({ enabled: false, asked: false, informed: false }),
    ).toBe('explain');
    // informed sin asked sería un estado incoherente; manda no haber pedido nunca
    expect(
      resolveNotificationPermissionAction({ enabled: false, asked: false, informed: true }),
    ).toBe('explain');
  });

  it('sin habilitar, ya pedido y aún sin informar devuelve inform-once (RF-11)', () => {
    expect(
      resolveNotificationPermissionAction({ enabled: false, asked: true, informed: false }),
    ).toBe('inform-once');
  });

  it('sin habilitar, ya pedido y ya informado devuelve silent: nunca más se insiste (RF-11)', () => {
    expect(
      resolveNotificationPermissionAction({ enabled: false, asked: true, informed: true }),
    ).toBe('silent');
  });
});

describe('pureza del módulo (principio 3 de la constitución)', () => {
  it('permission.ts no importa React ni AsyncStorage', () => {
    const source = readFileSync(join(__dirname, '..', 'permission.ts'), 'utf8');

    expect(source).not.toMatch(/['"]react(-native)?['"]/);
    expect(source).not.toMatch(/async-storage/);
  });
});

describe('resolveExactAlarmInvitationAction (cambio 1: RF-13, RF-14)', () => {
  it('sin soporte (iOS o Android < 12) devuelve silent: la invitación no existe', () => {
    expect(
      resolveExactAlarmInvitationAction({ supported: false, enabled: true, invited: false, informed: false }),
    ).toBe('silent');
    // tampoco se informa en plataformas sin el ajuste de alarmas exactas
    expect(
      resolveExactAlarmInvitationAction({ supported: false, enabled: true, invited: true, informed: false }),
    ).toBe('silent');
  });

  it('soportado pero sin notificaciones concedidas devuelve silent: no hay aviso que puntualizar (RF-11 manda)', () => {
    expect(
      resolveExactAlarmInvitationAction({ supported: true, enabled: false, invited: false, informed: false }),
    ).toBe('silent');
  });

  it('con notificaciones y sin haber invitado nunca devuelve invite: primera vez se explica (RF-13)', () => {
    expect(
      resolveExactAlarmInvitationAction({ supported: true, enabled: true, invited: false, informed: false }),
    ).toBe('invite');
    // informed sin invited sería incoherente; manda no haber invitado nunca
    expect(
      resolveExactAlarmInvitationAction({ supported: true, enabled: true, invited: false, informed: true }),
    ).toBe('invite');
  });

  it('invitado sin informar devuelve inform-once: la invitación se quedó a medias y se informa una sola vez (RF-14)', () => {
    expect(
      resolveExactAlarmInvitationAction({ supported: true, enabled: true, invited: true, informed: false }),
    ).toBe('inform-once');
  });

  it('invitado e informado devuelve silent: nunca se vuelve a invitar (RF-14)', () => {
    expect(
      resolveExactAlarmInvitationAction({ supported: true, enabled: true, invited: true, informed: true }),
    ).toBe('silent');
  });
});
