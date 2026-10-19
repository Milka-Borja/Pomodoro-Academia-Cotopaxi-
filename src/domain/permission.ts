// Lógica pura del flujo de permiso de notificaciones (spec 004, RF-10 y RF-11)
// y de la invitación a «Alarmas y recordatorios» (spec 004, cambio 1: RF-13, RF-14).
// Decide qué hace el primer «Iniciar» según la matriz permiso / pedido / informado
// y, para las alarmas exactas, según soporte / permiso / invitado / informado.
// Sin React, sin AsyncStorage y sin llamadas al sistema: los estados llegan
// ya resueltos como entrada (principio 3 de la constitución).

/**
 * Acción que debe tomar el primer «Iniciar» según el estado del permiso:
 * - 'start': hay permiso (o notificaciones encendidas): arranca directo.
 * - 'explain': primera vez sin permiso: la app explica antes de pedirlo.
 * - 'inform-once': ya se pidió y aún no se informó del rechazo: informa una vez.
 * - 'silent': ya se pidió y ya se informó: nunca más se insiste; arranca igual.
 */
export type PermissionAction = 'start' | 'explain' | 'inform-once' | 'silent';

export interface NotificationPermissionStatus {
  /** ¿Las notificaciones están habilitadas? (areNotificationsEnabled() del sistema) */
  enabled: boolean;
  /** ¿Ya se pidió el permiso alguna vez? (flag persistido @pomodoro/permission-asked) */
  asked: boolean;
  /** ¿Ya se informó una sola vez? (flag persistido @pomodoro/notif-informed) */
  informed: boolean;
}

/**
 * Resuelve la acción del primer «Iniciar» (RF-10, RF-11, decisión 5):
 * habilitado → arranca; sin habilitar y sin pedir → explicar; ya pedido sin
 * informar → informe único; ya pedido e informado → silencio (el temporizador
 * arranca en todos los caminos, sin volver a solicitar el permiso).
 */
export function resolveNotificationPermissionAction(
  input: NotificationPermissionStatus,
): PermissionAction {
  if (input.enabled) {
    return 'start';
  }
  if (!input.asked) {
    return 'explain';
  }
  if (!input.informed) {
    return 'inform-once';
  }
  return 'silent';
}

/**
 * Acción del primer «Iniciar» para la invitación a «Alarmas y recordatorios»
 * (spec 004, cambio 1):
 * - 'invite': primera vez en Android ≥ 12 con notificaciones concedidas: la app
 *   explica y ofrece abrir los ajustes del sistema (RF-13).
 * - 'inform-once': la invitación se quedó a medias («Ahora no» o fallo al abrir
 *   los ajustes): informa una sola vez del riesgo de aviso no puntual (RF-14).
 * - 'silent': ya se invitó e informó, o no aplica aquí: nunca más se insiste.
 */
export type ExactAlarmInvitationAction = 'invite' | 'inform-once' | 'silent';

export interface ExactAlarmInvitationStatus {
  /** ¿Plataforma con permiso de alarmas exactas? (Android, Platform.Version >= 31) */
  supported: boolean;
  /** ¿Notificaciones concedidas? (sin avisos que puntualizar no se invita) */
  enabled: boolean;
  /** ¿La invitación ya se mostró? (flag persistido @pomodoro/exact-alarm-invited) */
  invited: boolean;
  /** ¿El riesgo ya se informó? (flag persistido @pomodoro/exact-alarm-informed) */
  informed: boolean;
}

/**
 * Resuelve la invitación única a «Alarmas y recordatorios» (RF-13, RF-14):
 * sin soporte o sin notificaciones → silencio; sin haber invitado → invitar;
 * invitado sin informar → informe único; invitado e informado → silencio
 * (el temporizador arranca en todos los caminos, sin bloquear nunca).
 */
export function resolveExactAlarmInvitationAction(
  input: ExactAlarmInvitationStatus,
): ExactAlarmInvitationAction {
  if (!input.supported || !input.enabled) {
    return 'silent';
  }
  if (!input.invited) {
    return 'invite';
  }
  if (!input.informed) {
    return 'inform-once';
  }
  return 'silent';
}
