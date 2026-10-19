// Pantalla principal (specs 001, 002 y 003): cuenta regresiva mm:ss por fase,
// etiqueta de fase y fila de puntos de avance junto al reloj, botón alterno
// «Iniciar»/«Pausar»/«Reanudar» y «Reiniciar» con confirmación nativa. El
// estado es un CycleState (fase + temporizador delegado + contador de
// pomodoros); la lógica vive en src/domain (funciones puras); aquí solo se
// orquesta con useReducer y se refresca la vista cada 250 ms.
// Spec 003: la sesión se persiste en AsyncStorage al cambiar (tras hidratar) y
// se restaura al montar, detectando si una fase se cumplió con la app cerrada
// (RF-1, RF-2, RF-12); al volver de segundo plano se despacha RESUME, que
// mantiene la fase cumplida esperando acción sin avanzar sola (RF-6). El valor
// mostrado sale SIEMPRE de los timestamps, nunca del conteo del intervalo.
// Con la cuenta en marcha se programa el aviso de fin de fase en su timestamp
// de fin y se cancela en pausa/reinicio/fin (RF-4, RF-5, RF-10); al tocar el
// aviso el listener reevalúa el ciclo y muestra la fase terminada (RF-8); el
// primer «Iniciar» explica el permiso y solo informa una vez (RF-10, RF-11).
// Cambio 1 (T10): ese mismo «Iniciar» encadena la invitación única a
// «Alarmas y recordatorios» (RF-13) y su informe único si se quedó a medias
// (RF-14); ninguna de sus acciones bloquea el arranque.
// Spec 005 (T4): los ajustes personalizados se cargan al montar y con el
// foco; solo una fase detenida toma la duración nueva (RF-1, RF-7), las
// transiciones reciben el config vigente y la fila de puntos pinta el
// tamaño de ciclo ajustado (RF-8). Sin esto, Ajustes no sería observable.
// Rediseño v2 «fondo claro + tarjetas azules» (specs/rediseño-ui.md): fondo
// Gris Claro con textura sutil tipo cuaderno, reloj en una tarjeta Azul
// Marino con sombra sutil, textos blancos dentro de la tarjeta, botón
// principal en Dorado (píldora) y cabecera con icono de montaña en Azul
// Marino. Sin blur ni degradados: las dependencias del estilo anterior se
// eliminaron del proyecto. SOLO cambios presentacionales: la lógica del
// ciclo no se toca.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { ExactAlarmExplainer } from '@/components/ExactAlarmExplainer';
import { PermissionExplainer } from '@/components/PermissionExplainer';
import { PhaseEndAlarm } from '@/components/PhaseEndAlarm';
import {
  applySettingsToCycle,
  cancelResetCycle,
  confirmResetCycle,
  createInitialCycleState,
  detectPhaseEndWhileAway,
  getCyclePrimaryButtonLabel,
  getPhaseLabel,
  getPomodorosCompletados,
  isPhaseEndedAwaiting,
  pauseCycle,
  startCycle,
  startNextPhase,
  tickCycle,
  type CycleState,
  type PomodoroConfig,
} from '@/domain/cycle';
import { DEFAULT_SETTINGS, settingsToConfig, type PomodoroSettings } from '@/domain/settings';
import { formatMmSs, getRemainingMs } from '@/domain/timer';
import {
  resolveExactAlarmInvitationAction,
  resolveNotificationPermissionAction,
} from '@/domain/permission';
import {
  addEndOfPhaseResponseListener,
  areNotificationsEnabled,
  cancelScheduledNotifications,
  configureAlarmChannel,
  configureNotificationHandler,
  configureStopCategory,
  dismissActiveAlarm,
  openExactAlarmSettings,
  requestPermissions,
  scheduleEndOfPhaseNotification,
} from '@/notifications/notifications';
import {
  hasAskedNotificationPermission,
  hasInformedExactAlarmRisk,
  hasInformedNotificationsDisabled,
  hasSeenExactAlarmInvitation,
  loadCycleState,
  loadSettings,
  saveCycleState,
  setExactAlarmInvitationSeen,
  setExactAlarmRiskInformed,
  setNotificationPermissionAsked,
  setNotificationsDisabledInformed,
} from '@/storage/cycleStorage';
import { colors, studyTextureTile } from '@/theme/colors';

type CycleAction =
  | { type: 'START'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'CONFIRM_RESET'; config: PomodoroConfig }
  | { type: 'CANCEL_RESET' }
  | { type: 'TICK'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'START_NEXT'; now: number; config: PomodoroConfig }
  | { type: 'APPLY_SETTINGS'; config: PomodoroConfig }
  | { type: 'LOAD'; state: CycleState };

/**
 * Igualdad campo a campo de los ajustes (spec 005): sin esta comparación,
 * cada recarga con el foco crearía un objeto nuevo y repintaría (y podría
 * reescribir storage) sin ningún cambio real (RF-6: navegar no toca nada).
 */
function settingsIguales(a: PomodoroSettings, b: PomodoroSettings): boolean {
  return (
    a.studyMinutes === b.studyMinutes &&
    a.shortBreakMinutes === b.shortBreakMinutes &&
    a.longBreakMinutes === b.longBreakMinutes &&
    a.pomodorosPerCycle === b.pomodorosPerCycle
  );
}

// Reducer delgado (decisión 5 del plan 002): solo delega en el dominio.
// Exportado con nombre —el default lo pide expo-router— para las pruebas
// blancas de la identidad del TICK.
export function cycleReducer(state: CycleState, action: CycleAction): CycleState {
  switch (action.type) {
    case 'START':
      return startCycle(state, action.now);
    case 'PAUSE':
      return pauseCycle(state, action.now);
    case 'CONFIRM_RESET':
      // Vuelve al tiempo inicial de la fase ACTUAL —con el config vigente
      // (spec 005, RF-1)—, detenida, sin tocar el contador y sin arranque
      // automático (RF-6, RF-7).
      return confirmResetCycle(state, action.config);
    case 'CANCEL_RESET':
      // Mismo estado por identidad: la cuenta siguió su marcha durante el
      // diálogo y no se aplica ningún cambio (RF-5).
      return cancelResetCycle(state);
    case 'TICK': {
      const next = tickCycle(state, action.now);
      // El TICK solo busca repintar en PRIMER PLANO. Si nada cambió, se
      // devuelve estado y timer NUEVOS (mismos campos) por dos motivos:
      // 1) React no re-renderiza si el reducer devuelve el mismo objeto.
      // 2) El React Compiler memoiza `remaining` (Date.now() del render lo
      //    trata como puro) con guard en la IDENTIDAD de state.timer; sin
      //    un timer nuevo, el reloj se servía del caché y quedaba congelado
      //    en el último valor calculado (incidencia de T7 en dispositivo).
      // Con awaitingNextPhase, tickCycle devuelve el mismo estado sin avanzar
      // (RF-6, spec 003): una fase cumplida lejos espera acción del usuario.
      return next === state ? { ...state, timer: { ...state.timer } } : next;
    }
    case 'RESUME':
      // Al volver de segundo plano o de pantalla bloqueada (spec 003, T7):
      // si la fase se cumplió mientras tanto, queda esperando acción sin
      // avanzar; si no, devuelve el mismo estado (identidad). RF-1, RF-6.
      return detectPhaseEndWhileAway(state, action.now);
    case 'START_NEXT':
      // El usuario pidió avanzar desde «Fase terminada» (spec 003, T8, RF-8):
      // arranca la siguiente fase con la duración del config vigente (spec
      // 005, RF-1); fuera de ese estado es un no-op (identidad).
      return startNextPhase(state, action.now, action.config);
    case 'APPLY_SETTINGS':
      // Ajustes cargados al montar, con el foco o tras Guardar (spec 005,
      // RF-1, RF-7): solo una fase DETENIDA toma la nueva duración; una
      // iniciada queda intacta y el valor llegará con la próxima fase.
      // Identidad si la duración no cambió (sin repintado ni escritura).
      return applySettingsToCycle(state, action.config);
    case 'LOAD':
      // Sesión restaurada desde AsyncStorage al montar (RF-2, RF-12); el
      // dominio ya le aplicó detectPhaseEndWhileAway antes del dispatch.
      return action.state;
  }
}

export default function IndexScreen() {
  const [state, dispatch] = useReducer(cycleReducer, undefined, createInitialCycleState);
  // La sesión se restaura de forma asíncrona; hasta hidratar NO se persiste,
  // para no pisar la sesión guardada con el estado inicial virgen (RF-2, T7).
  const [hydrated, setHydrated] = useState(false);
  // Ajustes vigentes de la técnica (spec 005): por defecto 25/5/15/4; se
  // cargan al montar y se recargan con el foco al volver de Ajustes (RF-1,
  // RF-2). De ellos salen las duraciones y el tamaño del ciclo.
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  // Config del ciclo derivado de los ajustes: lo reciben las transiciones
  // (START_NEXT, CONFIRM_RESET, APPLY_SETTINGS).
  const config = settingsToConfig(settings);
  // Modal de explicación del permiso (spec 004, T6, RF-10): estado efímero,
  // solo vivo entre el primer «Iniciar» y su «Continuar».
  const [explicacionVisible, setExplicacionVisible] = useState(false);
  // Invitación única a «Alarmas y recordatorios» (spec 004, T10, cambio 1;
  // RF-13): estado efímero, vive solo entre el «Iniciar» que invita y la
  // elección del alumno. Lo que se persiste son los flags de «ya invitado» e
  // «informado» (RF-14): este modal no vuelve a aparecer por sesión, sino por
  // instalación.
  const [exactAlarmInviteVisible, setExactAlarmInviteVisible] = useState(false);
  // Vista de alarma en primer plano (spec 004, T7): estado efímero, nunca
  // persistido —quien reabre la app con la fase terminada no la ve (decisión 8).
  const [alarmVisible, setAlarmVisible] = useState(false);
  // Bandera «la ves correr en primer plano» (RF-6, decisión 8): solo armada
  // por los ticks con el tiempo andando; se consume al levantar la alarma y
  // se apaga al salir/entrar al primer plano o al atender el aviso fuera.
  const alarmPendingRef = useRef(false);
  // Espejo del status para el cierre del intervalo: ese callback vive en el
  // primer render y ver `state.timer.status` directamente sería un valor
  // obsoleto (mismo motivo que el incidente de memoización de 003).
  const timerStatusRef = useRef(state.timer.status);

  useEffect(() => {
    // Restaura la sesión Y los ajustes al montar (RF-2, RF-12; spec 005):
    // Promise.all en paralelo; JSON corrupto o ausente en cualquiera de los
    // dos cae a su fallback (estado inicial / defaults de la técnica).
    let cancelled = false;
    (async () => {
      const [stored, storedSettings] = await Promise.all([
        loadCycleState(),
        loadSettings(),
      ]);
      if (cancelled) {
        return;
      }
      const vigentes = storedSettings ?? DEFAULT_SETTINGS;
      setSettings(vigentes);
      if (stored) {
        const now = Date.now();
        dispatch({ type: 'LOAD', state: detectPhaseEndWhileAway(stored, now) });
      }
      // El APPLY_SETTINGS va SIEMPRE tras el LOAD (spec 005): así la fase
      // restaurada detenida toma el valor guardado (RF-1); sobre una fase
      // iniciada es identidad y no la toca (RF-7).
      dispatch({ type: 'APPLY_SETTINGS', config: settingsToConfig(vigentes) });
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Al volver de Ajustes (spec 005, RF-1/RF-2): recarga los ajustes y
      // aplica el config vigente. El fallback a DEFAULT descarta lo que no se
      // guardó en Ajustes («Atrás» sin «Guardar» no escribe nada, RF-4); sin
      // cambios, APPLY_SETTINGS es identidad y no hay escrituras extra.
      let cancelled = false;
      (async () => {
        const vigentes = (await loadSettings()) ?? DEFAULT_SETTINGS;
        if (cancelled) {
          return;
        }
        setSettings((prev) => (settingsIguales(prev, vigentes) ? prev : vigentes));
        dispatch({ type: 'APPLY_SETTINGS', config: settingsToConfig(vigentes) });
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    // Solo refresca la vista: el cálculo es por diferencia de timestamps.
    const intervalId = setInterval(() => {
      // Arma la bandera de alarma (RF-6): solo con la cuenta corriendo en
      // primer plano puede terminar «ante tus ojos»; el ref evita el estado
      // obsoleto del cierre capturado en el primer render.
      if (timerStatusRef.current === 'running') {
        alarmPendingRef.current = true;
      }
      dispatch({ type: 'TICK', now: Date.now() });
    }, 250);

    // Al volver de segundo plano o de pantalla bloqueada, RESUME detecta si la
    // fase se cumplió mientras tanto (queda esperando acción, RF-6); si no,
    // devuelve el mismo estado. Ya NO TICK: en 003 el avance en primer plano
    // distinto del scoping de la spec (decisión técnica 2 del plan).
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      // Salir o volver al primer plano DESARMA la alarma (decisión 8): la
      // vista solo se levanta si la fase termina estando la app EN PANTALLA;
      // lo que termina fuera lo retoma el aviso del sistema y, al volver,
      // RESUME muestra «Fase terminada» ya silenciosa.
      alarmPendingRef.current = false;
      if (nextState === 'active') {
        dispatch({ type: 'RESUME', now: Date.now() });
      }
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    // Espejo del status para la bandera de alarma (ver timerStatusRef).
    timerStatusRef.current = state.timer.status;
  }, [state.timer.status]);

  useEffect(() => {
    // Persistencia en cada CAMBIO REAL de la sesión (RF-2, RF-9, RF-12); sin
    // guardado periódico (decisión 1 del plan 003: los timestamps son la
    // fuente de verdad). Las deps son por CAMPO y no por objeto: el TICK
    // clona el timer cada 250 ms solo para repintar (ver case 'TICK'), y con
    // `state` completo como dep se escribiría en AsyncStorage 4 veces por
    // segundo sin ningún cambio que guardar. OJO: NO silenciar la regla de
    // deps del linter con un comentario de supresión dentro de este
    // componente — el React Compiler lo interpreta como opt-out y deja de
    // compilar TODA la pantalla (babel-plugin-react-compiler 1.0.0).
    if (!hydrated) {
      return;
    }
    saveCycleState(state);
  }, [
    hydrated,
    state.phase,
    state.timer.status,
    state.timer.durationMs,
    state.timer.endTimestampMs,
    state.timer.pausedRemainingMs,
    state.completedPomodoros,
    state.awaitingNextPhase,
  ]);

  useEffect(() => {
    // Handler de recepción de avisos (spec 003, T9) y configuración del aviso
    // (spec 004, T6, plan §4 «al montar»): canal de alarma Android (RF-2, RF-3,
    // RF-12) y categoría con la acción «Detener» (RF-7). Idempotente y una
    // sola vez —la app es de una sola pantalla—; sin esto RF-4 no sería
    // observable en ningún dispositivo.
    configureNotificationHandler();
    configureAlarmChannel();
    configureStopCategory();
  }, []);

  useEffect(() => {
    // RF-8 (decisión 6; cableado en el cierre de T10): al TOCAR el aviso de
    // fin de fase, el sistema abre la app en esta única pantalla y el listener
    // reevalúa el ciclo al instante (RESUME): si la fase se cumplió mientras
    // tanto, aparece «Fase terminada» con «Iniciar siguiente» sin esperar al
    // siguiente tick. En caliente el mismo caso lo cubre el RESUME del
    // AppState; aquí se cubre el toque del aviso (frío o caliente). Cleanup
    // al desmontar, como toda suscripción.
    const subscription = addEndOfPhaseResponseListener(() => {
      // Apertura desde el aviso —toque o «Detener», RF-7 y RF-8—: el aviso ya
      // se atendió fuera, así que NUNCA se levanta la vista de alarma aquí;
      // RESUME solo muestra la fase terminada con «Iniciar siguiente».
      alarmPendingRef.current = false;
      dispatch({ type: 'RESUME', now: Date.now() });
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Aviso de fin de fase (spec 003, T9, plan §3): mientras la cuenta corre
    // y sin fase en espera, se programa en el timestamp ABSOLUTO de fin (RF-4,
    // RF-5); en pausa, reinicio, detenida o «Fase terminada» se cancela todo
    // (RF-10). Sin cleanup al desmontar: el aviso debe SOBREVIVIR para que el
    // sistema lo entregue con la app en segundo plano o cerrada (RF-4).
    // Las deps son los 4 campos del plan (status, fin, fase, espera): los
    // TICK del repintado NO lo re-ejecutan. Misma advertencia que en el
    // efecto de persistencia: nada de supresiones eslint dentro de este
    // componente (el React Compiler dejaría de compilar la pantalla).
    const { status, endTimestampMs } = state.timer;
    if (status === 'running' && state.awaitingNextPhase !== true && endTimestampMs !== null) {
      void scheduleEndOfPhaseNotification(state.phase, endTimestampMs);
      return;
    }
    void cancelScheduledNotifications();
  }, [
    state.timer.status,
    state.timer.endTimestampMs,
    state.phase,
    state.awaitingNextPhase,
  ]);

  // El aviso ÚNICO de notificaciones desactivadas de 003 (RF-11, T10) se
  // ELIMINÓ aquí en spec 004, T6: se unificó en el flujo del primer «Iniciar»
  // (RF-10), que explica el permiso antes de pedirlo y solo informa una vez,
  // en contexto. Ver handlePrimaryPress / handleExplainerContinue.
  const remaining = formatMmSs(getRemainingMs(state.timer, Date.now()));
  // Estado «Fase terminada» (spec 003, T8): la fase se cumplió con la app
  // cerrada y espera acción; el botón pasa a «Iniciar siguiente» (RF-6, RF-8).
  const faseTerminada = isPhaseEndedAwaiting(state);
  const label = getCyclePrimaryButtonLabel(state);
  // Valores que se pintan (lógica probada en T7): etiqueta de fase (RF-8) y
  // forma de la fila de puntos (RF-9). Aquí solo se renderizan.
  const phaseLabel = getPhaseLabel(state.phase);
  // La fila pinta el tamaño de ciclo AJUSTADO (spec 005, RF-8): si el usuario
  // cambia los pomodoros con el ciclo en curso, el contador no se toca y la
  // fila puede quedar llena mientras la fase terminada espera acción.
  const dots = getPomodorosCompletados(state.completedPomodoros, settings.pomodorosPerCycle);

  useEffect(() => {
    // La fase terminó mientras la veías correr en primer plano (RF-6): se
    // levanta la vista de alarma UNA vez y la bandera se consume. Si terminó
    // fuera —reabertura o aviso atendido fuera— la bandera está apagada y
    // solo aparece «Fase terminada» (decisión 8). Deps solo de faseTerminada:
    // refs y setState son estables (React Compiler: sin supresiones).
    if (faseTerminada && alarmPendingRef.current) {
      alarmPendingRef.current = false;
      setAlarmVisible(true);
    }
  }, [faseTerminada]);

  // Informe ÚNICO de avisos no disponibles (RF-11): mismo texto en los dos
  // caminos que lo disparan («inform-once» y rechazo tras «Continuar»).
  const informAvisosNoDisponibles = () => {
    Alert.alert(
      'Avisos de fin de fase no disponibles',
      'El temporizador sigue funcionando, pero no sonará ni vibrará al terminar.',
    );
  };

  // Informe ÚNICO de riesgo de impuntualidad (spec 004, cambio 1; RF-14): sin
  // «Alarmas y recordatorios» el sistema degrada a alarma inexacta. Se usa en
  // los dos caminos («Ahora no» e invitación interrumpida); el flag de
  // informado garantiza que solo se muestra UNA vez.
  const informRiesgoAvisoNoPuntual = () => {
    Alert.alert(
      'El aviso puede no ser puntual',
      'Sin «Alarmas y recordatorios» el aviso puede llegar tarde o no llegar a la hora exacta. El temporizador sigue funcionando.',
    );
  };

  // Cadena de arranque del cambio 1 (RF-13, RF-14): tras el flujo de
  // notificaciones se resuelve la matriz pura de invitación. 'invite' pospone
  // el arranque (el modal decide); 'inform-once' avisa una vez; 'silent' no
  // insiste. TODOS los caminos terminan en START: ninguna invitación bloquea
  // el temporizador (RF-14). notifsOk es el resultado del flujo previo: sin
  // notificaciones concedidas no hay aviso que puntualizar (RF-11 manda).
  const arrancarConInvitacion = async (notifsOk: boolean) => {
    const invitation = resolveExactAlarmInvitationAction({
      supported: Platform.OS === 'android' && Number(Platform.Version) >= 31,
      enabled: notifsOk,
      invited: await hasSeenExactAlarmInvitation(),
      informed: await hasInformedExactAlarmRisk(),
    });
    if (invitation === 'invite') {
      setExactAlarmInviteVisible(true);
      return; // NO arranca: ambas acciones del modal arrancan (RF-13).
    }
    if (invitation === 'inform-once') {
      // Invitación interrumpida entre los dos flags: informa una vez (RF-14).
      informRiesgoAvisoNoPuntual();
      await setExactAlarmRiskInformed();
    }
    dispatch({ type: 'START', now: Date.now() });
  };

  // Flujo de permiso del PRIMER arranque (spec 004, T6; RF-10, RF-11): el
  // «Iniciar» en reposo resuelve la matriz pura del dominio. Solo 'explain'
  // pospone el arranque (se muestra el modal); en todos los demás caminos se
  // encadena con la invitación de alarmas exactas (RF-13). Los tres estados
  // llegan del sistema/storage: async.
  const startFromIdle = async () => {
    const action = resolveNotificationPermissionAction({
      enabled: await areNotificationsEnabled(),
      asked: await hasAskedNotificationPermission(),
      informed: await hasInformedNotificationsDisabled(),
    });
    if (action === 'explain') {
      setExplicacionVisible(true);
      return;
    }
    if (action === 'inform-once') {
      informAvisosNoDisponibles();
      await setNotificationsDisabledInformed();
    }
    // 'start' → notifsOk true (puede invitar); 'silent' → false (sin avisos,
    // RF-11: nunca más se insiste) y por tanto sin invitación (RF-13).
    await arrancarConInvitacion(action === 'start');
  };

  // «Continuar» del modal (RF-10): ÚNICO punto que dispara el diálogo del
  // sistema; se persiste que ya se pidió. Si se rechaza, se informa una sola
  // vez con el flag de 003 (RF-11). Después, la cadena llega a la invitación
  // de alarmas exactas solo si quedó concedido (RF-13); el reloj arranca pase
  // lo que pase.
  const handleExplainerContinue = async () => {
    const concedido = await requestPermissions();
    await setNotificationPermissionAsked();
    if (!concedido && !(await hasInformedNotificationsDisabled())) {
      informAvisosNoDisponibles();
      await setNotificationsDisabledInformed();
    }
    setExplicacionVisible(false);
    await arrancarConInvitacion(concedido);
  };

  // «Abrir ajustes» de la invitación (spec 004, cambio 1; RF-13): se marcan
  // los DOS flags sin informe (la pantalla del sistema es la elección del
  // alumno y su resultado no es comprobable desde JS), la sesión arranca ANTES
  // de irse a Ajustes y después se abre la pantalla del sistema (mejor
  // esfuerzo: si falla, el temporizador ya corre igual, RF-14).
  const handleExactAlarmOpenSettings = async () => {
    await setExactAlarmInvitationSeen();
    await setExactAlarmRiskInformed();
    setExactAlarmInviteVisible(false);
    dispatch({ type: 'START', now: Date.now() });
    openExactAlarmSettings();
  };

  // «Ahora no» (spec 004, cambio 1; RF-14): PRIMERO el flag de invitado —así
  // no se vuelve a invitar aunque la app se cierre—; después el informe único
  // si aún no se hizo; y la sesión arranca: nunca se bloquea el temporizador.
  const handleExactAlarmSkip = async () => {
    await setExactAlarmInvitationSeen();
    if (!(await hasInformedExactAlarmRisk())) {
      informRiesgoAvisoNoPuntual();
      await setExactAlarmRiskInformed();
    }
    setExactAlarmInviteVisible(false);
    dispatch({ type: 'START', now: Date.now() });
  };

  const handlePrimaryPress = () => {
    const now = Date.now();
    if (faseTerminada) {
      // Avance explícito a la siguiente fase (RF-8): único camino que
      // transiciona fuera del estado de espera; la duración de la que sigue
      // sale del config vigente (spec 005, RF-1).
      dispatch({ type: 'START_NEXT', now, config });
      return;
    }
    if (state.timer.status === 'running') {
      dispatch({ type: 'PAUSE', now });
      return;
    }
    if (state.timer.status === 'paused') {
      dispatch({ type: 'START', now });
      return;
    }
    // status === 'idle': primer arranque, con el flujo de permiso (RF-10).
    void startFromIdle();
  };

  // Botón «Detener» de la vista de alarma (RF-7): corta el sonido y la
  // vibración del aviso en curso y cierra la vista; debajo queda la fase
  // terminada con «Iniciar siguiente» (mismo resultado que abrir el aviso).
  const handleAlarmStop = async () => {
    await dismissActiveAlarm();
    setAlarmVisible(false);
  };

  // Diálogo nativo de confirmación, acción crítica (rn-conventions). NO se
  // pausa ni se congela nada al abrirlo: el estado usa timestamps, así que la
  // cuenta sigue su marcha mientras el diálogo está visible.
  const handleResetPress = () => {
    Alert.alert('¿Reiniciar el temporizador?', undefined, [
      { text: 'Cancelar', onPress: () => dispatch({ type: 'CANCEL_RESET' }) },
      // El config vigente (spec 005, RF-1) fija el tiempo inicial de la
      // fase: Reiniciar no pierde los ajustes personalizados.
      { text: 'Reiniciar', onPress: () => dispatch({ type: 'CONFIRM_RESET', config }) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Textura sutil de fondo (spec §3): puntos muy separados al 3 % de
          opacidad, aspecto de «cuaderno» de estudio. Decorativa y oculta a
          los lectores de pantalla; no intercepta toques. */}
      <Image
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
        resizeMode="repeat"
        source={{ uri: studyTextureTile }}
        style={styles.texture}
      />
      {/* Cabecera (spec 005, RF-5): marca de agua institucional a la
          izquierda y engranaje que abre Ajustes a la derecha. */}
      <View style={styles.header}>
        {/* Marca de agua interna (spec rediseño-ui.md §3): montaña
            minimalista en Azul Marino sobre el fondo claro, decorativa y
            oculta a los lectores de pantalla. */}
        <MaterialCommunityIcons
          accessibilityElementsHidden={true}
          color={colors.navyBlue}
          importantForAccessibility="no-hide-descendants"
          name="summit"
          size={40}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajustes"
          hitSlop={12}
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.gearButton, pressed && styles.gearButtonPressed]}
        >
          {/* ⚙ (U+2699) + selector de variante de texto (U+FE0E). */}
          <Text style={styles.gearText}>{'⚙︎'}</Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        {/* Tarjeta azul (spec §1-2): el reloj vive sobre Azul Marino sólido
            para enfocar la vista del estudiante; sombra sutil de elevación,
            esquinas redondeadas y SIN línea de borde. */}
        <View style={styles.clockCard}>
          <Text
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={`Fase actual: ${phaseLabel}`}
            style={styles.phaseLabel}
          >
            {phaseLabel}
          </Text>
          {faseTerminada && (
            <Text
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel="Fase terminada"
              style={styles.phaseEnded}
            >
              Fase terminada
            </Text>
          )}
          <Text
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={`Tiempo restante: ${remaining}`}
            style={styles.clock}
          >
            {remaining}
          </Text>
          <View
            // accessible={true} fuerza el nodo de lectura: agrupa los
            // puntos como una sola parada de TalkBack/VoiceOver. El «de N»
            // sale del tamaño de ciclo ajustado (spec 005, RF-8).
            accessible={true}
            accessibilityLabel={`Pomodoros completados: ${state.completedPomodoros} de ${settings.pomodorosPerCycle}`}
            style={styles.dotsRow}
          >
            {dots.map((completado, index) => (
              <View
                key={index}
                style={[styles.dot, completado ? styles.dotFilled : styles.dotEmpty]}
              />
            ))}
          </View>
        </View>
          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={handlePrimaryPress}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            >
              <Text style={styles.primaryButtonText}>{label}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reiniciar"
              onPress={handleResetPress}
              style={({ pressed }) => [styles.resetButton, pressed && styles.resetButtonPressed]}
            >
              <Text style={styles.resetButtonText}>Reiniciar</Text>
            </Pressable>
          </View>
        </View>
        {/* Explicación previa del permiso (RF-10): solo existe entre el primer
            «Iniciar» y su «Continuar»; nunca se monta si ya se pidió (RF-11). */}
        <PermissionExplainer
          visible={explicacionVisible}
          onContinue={handleExplainerContinue}
        />
        {/* Invitación única a «Alarmas y recordatorios» (cambio 1, RF-13,
            RF-14): solo la primera vez en Android ≥ 12 con notificaciones;
            ambas acciones arrancan la sesión y cierran el modal. */}
        <ExactAlarmExplainer
          visible={exactAlarmInviteVisible}
          onOpenSettings={handleExactAlarmOpenSettings}
          onSkip={handleExactAlarmSkip}
        />
        {/* Vista de alarma de primer plano (RF-6, RF-7): solo cuando la fase
            terminó EN pantalla; se cierra exclusivamente con «Detener». */}
        <PhaseEndAlarm
          visible={alarmVisible}
          phaseLabel={phaseLabel}
          onStop={handleAlarmStop}
        />
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    // Fondo general claro (spec rediseño-ui.md §1: Gris Claro).
    flex: 1,
    backgroundColor: colors.smokeBackground,
  },
  texture: {
    // Textura sutil tipo «cuaderno» (spec §3): tile de puntos repetido al
    // 3 % de opacidad, detrás de todo y sin interceptar toques.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.03,
    pointerEvents: 'none',
  },
  header: {
    // Cabecera (RF-5): marca de agua a la izquierda, engranaje a la derecha.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  gearButton: {
    // Área táctil ≥ 44 px con padding + hitSlop (rn-conventions).
    minWidth: 44,
    minHeight: 44,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearButtonPressed: {
    opacity: 0.6,
  },
  gearText: {
    // Azul Marino sobre Gris Claro: contraste AA (cotopaxi-brand).
    // Glifo agrandado (24 → 30) a petición del usuario: contrapunto visual
    // con el icono de la montaña de la cabecera.
    color: colors.navyBlue,
    fontSize: 30,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    // Separación entre la tarjeta azul y los botones: sin este gap, la
    // tarjeta (flex: 1) se quedaba pegada a «Iniciar» y se veía apretada.
    gap: 24,
  },
  clockCard: {
    // Tarjeta azul (spec §1-2): Azul Marino sólido para enfocar la vista
    // del estudiante; esquinas redondeadas, SIN borde y con sombra sutil
    // de elevación (Flat Moderno). Blanco sobre Azul Marino: ≈ 15:1 (AA).
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 24,
    backgroundColor: colors.navyBlue,
    paddingVertical: 32,
    paddingHorizontal: 24,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  phaseLabel: {
    // Blanco Puro sobre la tarjeta Azul Marino (spec §1: máxima legibilidad).
    color: colors.snowWhite,
    fontSize: 22,
    fontWeight: '600',
  },
  phaseEnded: {
    // Estado «Fase terminada» (T8): semibold en Blanco Puro sobre Azul
    // Marino (AA). Sin Dorado en texto (cotopaxi-brand).
    color: colors.snowWhite,
    fontSize: 20,
    fontWeight: '600',
  },
  clock: {
    color: colors.snowWhite,
    fontSize: 72,
    fontWeight: '600',
    // Sin salto visual al cambiar los segundos (rn-conventions).
    fontVariant: ['tabular-nums'],
  },
  dotsRow: {
    // Fila de puntos de avance (RF-9; tamaño según ajustes, spec 005 RF-8):
    // círculos de ~14 px, tantos como pomodoros por ciclo.
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotFilled: {
    // Completado: Dorado como indicador de progreso (spec §1) sobre Azul
    // Marino (≈ 6.9:1, muy por encima del 3:1 de componentes esenciales).
    backgroundColor: colors.gold,
  },
  dotEmpty: {
    // Pendiente: transparente con borde de 2 px en Blanco al 35 % (la
    // tarjeta es azul: el gris neutro no se distinguiría).
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.dotPendingBorder,
  },
  controls: {
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    // Botón principal (spec §2): píldora Dorado con texto Blanco según la
    // spec — decisión explícita del usuario pese al contraste ≈ 2.6:1
    // (por debajo del AA que exige cotopaxi-brand; queda registrado aquí).
    backgroundColor: colors.gold,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 100,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: colors.snowWhite,
    fontSize: 20,
    fontWeight: '600',
  },
  resetButton: {
    // Secundario (spec §2): fondo semitransparente que no compite con la
    // acción principal; texto Azul Marino (AA sobre el fondo claro).
    backgroundColor: colors.navySoft,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 100,
    minWidth: 220,
    alignItems: 'center',
  },
  resetButtonPressed: {
    opacity: 0.85,
  },
  resetButtonText: {
    color: colors.navyBlue,
    fontSize: 18,
    fontWeight: '600',
  },
});
