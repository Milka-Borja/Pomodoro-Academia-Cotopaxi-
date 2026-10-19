# Plan — Spec 004: Recibir aviso al terminar el tiempo

Spec: `specs/004-avisos/spec.md` (Estado: **aprobada**, con cambio 1: RF-13 y RF-14 sin implementar).
Decisiones: `specs/004-avisos/decisiones.md` (Decisión 1–11, todas cerradas; la 11 condiciona a la 7).
Base: `docs/constitution.md`, `AGENTS.md`, skills `pomodoro-rules`, `cotopaxi-brand` y `rn-conventions`.
Cobertura: RF-1 a RF-14, RNF-1 a RNF-3. Cada sección indica qué RF cubre.

> **Scoping del RF-4 (confirmado por el usuario):** el RF-4 pide "encender la
> pantalla con una vista de alarma" con la app cerrada. Verificado contra el
> SDK 57 de `expo-notifications`: su API JS **no expone** `fullScreenIntent`
> (no está en `NotificationChannelInput` ni en el contenido de la notificación),
> y el permiso `USE_FULL_SCREEN_INTENT` es un permiso especial en Android 14+
> que RNF-3 prohíbe solicitar (solo se permite pedir el de notificaciones). El
> RF-4 se entrega en su **máximo alcanzable con el stack autorizado**: notificación
> heads-up de importancia máxima visible en la pantalla de bloqueo + vista de
> alarma en primer plano (ver decisión técnica 3). **El usuario aceptó esta
> degradación en la fase de plan; queda registrada aquí y en decisión técnica 3.**
>
> **Cambio 1 (RF-13 y RF-14, aprobado en `/sdd-change`):** invitación única por
> código a activar «Alarmas y recordatorios» (observación 1 de la validación de
> 004). En el SDK 57 no hay API JS para leer `canScheduleExactAlarms()` (solo lo
> comprueba en nativo `ExpoSchedulingDelegate.kt`, con caída silenciosa a alarma
> inexacta: la causa raíz de T8), así que la invitación no puede condicionarse al
> estado: se muestra **una sola vez por instalación** (caso límite de la spec) y
> se abre la pantalla del sistema con `Linking.sendIntent` (integrado en React
> Native, cero dependencias). `app.json` gana
> `android.permissions: ["SCHEDULE_EXACT_ALARM"]` para el development build; en
> Expo Go rige el manifiesto de Expo Go, que ya lo declara (verificado en T8).

---

## 1. Archivos que se crean o modifican

| Archivo | Acción | Responsabilidad | RF |
|---|---|---|---|
| `src/domain/cycle.ts` | Modifica | Unifica el fin de fase en primer plano con el estado «fase terminada»: `tickCycle` pasa a `awaitingNextPhase` en vez de auto-avanzar (RF-6, decisiones 3 y 10). Sigue 100 % puro, con `nowMs` inyectado. | RF-6, RF-9 |
| `src/domain/permission.ts` | **Crea** | Lógica pura de los flujos de permiso: `resolveNotificationPermissionAction({ enabled, asked, informed })` decide el primer «Iniciar» (RF-10, RF-11); **cambio 1**: `resolveExactAlarmInvitationAction({ supported, enabled, invited, informed })` decide la invitación a «Alarmas y recordatorios» (RF-13, RF-14). Sin React ni storage. | RF-10, RF-11, RF-13, RF-14 |
| `src/notifications/notifications.ts` | Modifica | Crea el canal de alarma Android (sonido por defecto en stream de ALARM, vibración, importancia máxima, visible en bloqueo), activa el sonido en el handler, añade la categoría con acción «Detener», programa el aviso en ese canal y expone `dismissActiveAlarm()` y un listener que distingue toque vs. «Detener». **Cambio 1**: añade `openExactAlarmSettings()` (`Linking.sendIntent` a la pantalla de alarmas exactas, error tragado). | RF-1, RF-2, RF-3, RF-7, RF-8, RF-9, RF-12, RF-13 |
| `src/storage/cycleStorage.ts` | Modifica | Flags de permiso: `@pomodoro/permission-asked` con `hasAskedNotificationPermission` / `setNotificationPermissionAsked` y reutiliza `@pomodoro/notif-informed`. **Cambio 1**: `@pomodoro/exact-alarm-invited` e `@pomodoro/exact-alarm-informed` con `hasSeenExactAlarmInvitation` / `setExactAlarmInvitationSeen` e `hasInformedExactAlarmRisk` / `setExactAlarmRiskInformed`. | RF-10, RF-11, RF-13, RF-14 |
| `src/components/PhaseEndAlarm.tsx` | **Crea** | Vista de alarma de primer plano: pantalla grande con la fase terminada y botón «Detener», con identidad Cotopaxi. Componente presentacional; recibe props y callbacks. | RF-6, RF-7, RNF-2 |
| `src/components/PermissionExplainer.tsx` | **Crea** | Modal con la explicación propia de por qué se necesita el permiso y su botón «Continuar». Presentacional. | RF-10, RNF-2 |
| `src/components/ExactAlarmExplainer.tsx` | **Crea** (cambio 1) | Modal de invitación única a «Alarmas y recordatorios» con «Abrir ajustes» y «Ahora no», mismo patrón visual que `PermissionExplainer` y identidad Cotopaxi. Presentacional. | RF-13, RF-14, RNF-2 |
| `app/index.tsx` | Modifica | Engancha el flujo de permiso al primer «Iniciar»; muestra la vista de alarma al cumplirse la fase en primer plano; «Detener» cierra la alarma; el listener de avisos unifica toque y «Detener»; **elimina** el `Alert` de arranque de 003 (unificado en este flujo). **Cambio 1**: cadena `arrancarConInvitacion` tras el flujo de notificaciones y los dos handlers de la invitación. | RF-1 a RF-14 (capa de interfaz) |
| `app.json` | **Modifica** (cambio 1) | `android.permissions: ["SCHEDULE_EXACT_ALARM"]` para que la pantalla de «Alarmas y recordatorios» exista en el development build; en Expo Go rige el manifiesto de Expo Go, que ya lo declara (verificado en T8). | RF-13 |
| `package.json` | **No se modifica** | Cero dependencias nuevas: canal, categorías, acciones, vibración y `Linking.sendIntent` ya vienen en el stack (principio 1). | RNF-1, RNF-3 |
| `src/theme/colors.ts` | **No se modifica** | Única fuente de la paleta Cotopaxi (principio 7). | RNF-2 |
| `src/domain/__tests__/cycle.test.ts` | Modifica | Nuevos casos del fin unificado; los casos de 002 que asumían auto-avance en primer plano se ajustan al nuevo comportamiento (regresión documentada). | RF-6, RF-9 |
| `src/domain/__tests__/permission.test.ts` | **Crea** | Pruebas Jest de las matrices del flujo de permiso y de la invitación de alarmas exactas (sin mocks). **Cambio 1**: fila de la matriz de RF-13/RF-14. | RF-10, RF-11, RF-13, RF-14 |
| `src/notifications/__tests__/notifications.test.ts` | Modifica | Extiende el mock con canal/categoría/dismiss y verifica la configuración del canal, el uso del canal y la categoría en el aviso y la distinción toque/«Detener». **Cambio 1**: `openExactAlarmSettings` → `Linking.sendIntent`. | RF-2, RF-3, RF-7, RF-12, RF-13 |
| `src/storage/__tests__/cycleStorage.test.ts` | Modifica | Pruebas de los flags de permiso. **Cambio 1**: los dos flags de alarmas exactas. | RF-10, RF-11, RF-13, RF-14 |
| `app/__tests__/index.test.tsx` | Modifica | Flujo de permiso en el primer «Iniciar», vista de alarma con «Detener», y retirada del Alert de arranque de 003. **Cambio 1**: invitación, handlers y casos iOS/Android < 12. | RF-6, RF-7, RF-10, RF-11, RF-13, RF-14 |
| `MEMORY.md` | Modifica | Al terminar T10, actualizar solo «Estado actual» y «Próximos pasos» (siguiente: `/sdd-validate 004-avisos`). | — |

## 2. Funciones puras de lógica (`src/domain/`)

### `src/domain/cycle.ts` — fin de fase unificado (RF-6, RF-9)

Cambio de comportamiento (decisión 3: «un solo camino en todas las
situaciones»; decisión 10: «se muestra primero la fase terminada»): cuando la
fase llega a cero **en primer plano**, el ciclo ya no auto-avanza a la
siguiente; pasa al estado `awaitingNextPhase` —«Fase terminada» con «Iniciar
siguiente»—, el mismo estado que 003 usa al volver de segundo plano. El avance
solo ocurre por acción explícita del usuario en cualquier situación.

- `tickCycle(state, nowMs)` — **antes** de delegar en `tick`, intenta la
  detección: si `detectPhaseEndWhileAway` produce un estado nuevo, lo devuelve
  (fase intacta, contador +1 si era estudio, `awaitingNextPhase: true`). Si no,
  delega en `tick` como hasta ahora para refrescar el 00:00 del resto. La
  guardia de `awaitingNextPhase` del inicio se conserva. *(RF-6, RF-9)*
- El resto de `cycle.ts` no cambia: `advanceToNextPhase`, `startNextPhase`,
  `detectPhaseEndWhileAway`, `getCyclePrimaryButtonLabel` e
  `isPhaseEndedAwaiting` ya modelan exactamente este estado. *(RF-8)*

### `src/domain/permission.ts` — flujos de permiso e invitación de alarmas exactas (RF-10, RF-11, RF-13, RF-14)

Nuevo módulo puro, testeable sin mocks:

```
PermissionAction = 'start' | 'explain' | 'inform-once' | 'silent'

resolveNotificationPermissionAction(input: {
  enabled: boolean   // areNotificationsEnabled() del sistema
  asked: boolean     // ya se pidió el permiso alguna vez (flag persistido)
  informed: boolean  // ya se informó una sola vez (flag persistido)
}): PermissionAction
```

Reglas (RF-10, RF-11, decisión 5):

- `enabled` → `'start'`: hay permiso (o las notificaciones están encendidas):
  arranca directo, sin diálogos.
- `!enabled && !asked` → `'explain'`: primera vez; la app muestra su propia
  explicación antes de disparar el diálogo del sistema.
- `!enabled && asked && !informed` → `'inform-once'`: se rechazó o está
  desactivado; se informa una sola vez y se arranca sin avisos.
- `!enabled && asked && informed` → `'silent'`: nunca más se insiste
  (RF-11: «no vuelve a solicitar el permiso»); el temporizador arranca igual.

En `'inform-once'` y en el rechazo tras `'explain'` se reutiliza el **mismo**
flag `@pomodoro/notif-informed` de 003: el usuario es informado una sola vez
en total, por el camino que llegue primero (casos límite de la spec).

**Cambio 1 — matriz de la invitación a «Alarmas y recordatorios» (RF-13, RF-14, decisión 11):**

```
ExactAlarmInvitationAction = 'invite' | 'inform-once' | 'silent'

resolveExactAlarmInvitationAction(input: {
  supported: boolean  // Platform.OS === 'android' && Number(Platform.Version) >= 31
  enabled: boolean    // notificaciones concedidas (sin ellas no hay aviso)
  invited: boolean    // la invitación ya se mostró (flag persistido)
  informed: boolean   // el riesgo ya se informó una vez (flag persistido)
}): ExactAlarmInvitationAction
```

Reglas:

- `!supported || !enabled` → `'silent'`: iOS, Android < 12 o sin notificaciones:
  la invitación no existe (RF-13, casos límite).
- `!invited` → `'invite'`: primera vez; modal propio con «Abrir ajustes» y
  «Ahora no», y **ninguna acción bloquea el temporizador** (ambas arrancan la
  sesión).
- `invited && !informed` → `'inform-once'`: la invitación se quedó a medias (la
  app se cerró entre los dos flags); se informa una vez y nunca más.
- `invited && informed` → `'silent'`: nunca se vuelve a invitar (RF-14).

En «Abrir ajustes» se marcan los dos flags sin Alert (la pantalla del sistema es
la decisión del alumno y su resultado no es comprobable desde JS); en «Ahora no»
se marca `invited` **primero** —así «no vuelve a invitar» se cumple aunque la app
se cierre— y después el informe único con `informed`.

## 3. Persistencia (`src/storage/`)

- `@pomodoro/permission-asked` (nuevo, `PERMISSION_ASKED_KEY`): guarda `'true'`
  la primera vez que se dispara el diálogo del sistema
  (`requestPermissionsAsync`). `hasAskedNotificationPermission()` devuelve
  `value !== null` (ausente o error → false), como el flag de 003.
  *(RF-10, RF-11)*
- **Cambio 1:** `@pomodoro/exact-alarm-invited` y `@pomodoro/exact-alarm-informed`
  (nuevos, `EXACT_ALARM_INVITED_KEY` / `EXACT_ALARM_INFORMED_KEY`) con
  `hasSeenExactAlarmInvitation` / `setExactAlarmInvitationSeen` e
  `hasInformedExactAlarmRisk` / `setExactAlarmRiskInformed`; mismo patrón que los
  flags de 003 (`value !== null`, ausente o error → false, `'true'` persistido).
  *(RF-13, RF-14)*
- `@pomodoro/session` y `@pomodoro/notif-informed`: **sin cambios de formato**;
  solo cambia quién escribe en el flag de informado (el flujo del primer
  «Iniciar» en vez del `Alert` de arranque). *(RF-11)*
- La sesión guardada no gana campos: `awaitingNextPhase` ya se persiste desde
  003, y la vista de alarma es estado **efímero** de UI (nunca se guarda: un
  alumno que reabre la app horas después ve «Fase terminada» sin alarma).
  *(RF-6)*

## 4. Algoritmo en pseudocódigo

Notificaciones (`src/notifications/notifications.ts`):

```
// Al montar la app (una vez; idempotente). RF-2, RF-3, RF-7, RF-12.
funcion configureAlarmChannel():            // Android; no-op en iOS
  setNotificationChannelAsync('phase-alarm', {
    name: 'Aviso de fin de fase',
    importance: AndroidImportance.MAX,      // heads-up + prioridad (RF-2)
    sound: 'default',                       // tono por defecto del sistema (RF-12)
    audioAttributes: { usage: AndroidAudioUsage.ALARM,
                       contentType: AndroidAudioContentType.SONIFICATION },
                       // stream de ALARM: suena en modo silencio (RF-3, decisión 1)
    vibrationPattern: [0, 500, 500, 500],
    enableVibrate: true,                    // RF-2, RF-3
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC, // RF-3
  })

funcion configureNotificationHandler():     // MODIFICA el de 003
  handleNotification: { shouldShowBanner: true, shouldShowList: true,
                        shouldPlaySound: true,   // ← era false (RF-2, RF-6)
                        shouldSetBadge: false }

funcion configureStopCategory():            // Android e iOS
  setNotificationCategoryAsync('phase-end', [
    { id: 'stop', buttonTitle: 'Detener', options: { opensAppToForeground: true } }
  ])                                         // RF-7

scheduleEndOfPhaseNotification(phase, endTimestampMs):   // MODIFICA el de 003
  scheduleNotificationAsync({
    content: { title: 'Fin de fase',
               body: `${etiqueta(phase)} terminado. Toca para continuar tu sesión.`,
               categoryIdentifier: 'phase-end' },        // RF-7
    trigger: { type: DATE, date: endTimestampMs,
               channelId: 'phase-alarm' }                // RF-2, RF-3, RF-12
  })

addEndOfPhaseResponseListener(onAviso):     // MODIFICA el de 003
  addNotificationResponseReceivedListener(respuesta =>
    si respuesta.actionIdentifier == 'stop':
      dismissAllNotificationsAsync()        // corta sonido/vibración (RF-7)
      onAviso({ origen: 'detener' })
    si no:                                   // toque normal en la notificación
      onAviso({ origen: 'notificacion' })    // RF-8
  )
```

Ciclo (`src/domain/cycle.ts`):

```
// Fin de fase unificado en PRIMER PLANO (RF-6, decisiones 3 y 10)
funcion tickCycle(estado, ahora):
  si estado.awaitingNextPhase == true: retornar estado
  d = detectPhaseEndWhileAway(estado, ahora)   // running vencido → awaiting +1
  si d !== estado: retornar d                  // RF-6: fase terminada, sin auto-avance
  t = tick(estado.timer, ahora)                // refresco normal (pausa, idle…)
  retornar (t === estado.timer) ? estado : { ...estado, timer: t }
```

Pantalla (`app/index.tsx`):

```
estado = useReducer(cycleReducer, …)           // sin cambios de reducer
alarmVisible = useState(false)                 // efímero; RF-6, RF-7
explicacionVisible = useState(false)           // RF-10
exactAlarmInviteVisible = useState(false)      // efímero; RF-13 (cambio 1)

al montar:
  configureNotificationHandler()
  configureAlarmChannel()                      // Android
  configureStopCategory()
  (resto de 003 intacto: hidratar, intervalo 250 ms, AppState, persistencia)
  // ELIMINADO: el Alert de «notificaciones desactivadas» de 003 (RF-11 unificado)

intervalo (250 ms):
  si state.timer.status == 'running': alarmaPendiente.current = true
  dispatch({ TICK, ahora: Date.now() })

useEffect([faseTerminada]):
  si faseTerminada && alarmaPendiente.current:  // la fase terminó EN primer plano
    setAlarmVisible(true); alarmaPendiente.current = false    // RF-6

listener de avisos (response):
  dispatch({ RESUME, ahora: Date.now() })       // muestra «Fase terminada» (RF-8)
  // sin overlay: al abrir la app el aviso ya se detuvo solo (RF-8)

handlePrimaryPress:
  si faseTerminada: dispatch(START_NEXT); retornar       // RF-8
  si status == 'running': dispatch(PAUSE); retornar
  si status == 'paused':  dispatch(START); retornar       // sin prompts (solo el primer Iniciar)
  // status == 'idle': flujo de permiso del PRIMER arranque (RF-10)
  accion = resolveNotificationPermissionAction({
    enabled: await areNotificationsEnabled(),
    asked:   await hasAskedNotificationPermission(),
    informed:await hasInformedNotificationsDisabled() })
  si accion == 'explain':  setExplicacionVisible(true); retornar      // no arranca aún
  si accion == 'inform-once':
    Alert.alert('Avisos de fin de fase no disponibles', 'El temporizador sigue funcionando, pero no sonará ni vibrará al terminar.')
    await setNotificationsDisabledInformed()
  await arrancarConInvitacion(accion == 'start')     // RF-13: solo con notifs concedidas

handleExplainerContinue:                           // botón del modal (RF-10)
  concedido = await requestPermissions()
  await setNotificationPermissionAsked()           // ya se pidió: no se vuelve a pedir
  si !concedido && !await hasInformedNotificationsDisabled():
    Alert.alert(…); await setNotificationsDisabledInformed()   // informa una vez (RF-11)
  setExplicacionVisible(false)
  await arrancarConInvitacion(concedido)           // cadena RF-10 → RF-13

arrancarConInvitacion(notifsOk):                   // cambio 1: RF-13, RF-14
  inv = resolveExactAlarmInvitationAction({
    supported: Platform.OS == 'android' && Number(Platform.Version) >= 31,
    enabled:   notifsOk,
    invited:   await hasSeenExactAlarmInvitation(),
    informed:  await hasInformedExactAlarmRisk() })
  si inv == 'invite': setExactAlarmInviteVisible(true); retornar   // NO arranca aún: ambas acciones arrancan
  si inv == 'inform-once':                          // invitación interrumpida: informe único (RF-14)
    Alert.alert('El aviso puede no ser puntual', 'Sin «Alarmas y recordatorios» el aviso puede llegar tarde. El temporizador sigue funcionando.')
    await setExactAlarmRiskInformed()
  dispatch(START)                                  // arranca en todos los caminos (RF-11, RF-13)

handleExactAlarmOpenSettings:                     // «Abrir ajustes» (RF-13)
  await setExactAlarmInvitationSeen()
  await setExactAlarmRiskInformed()                // ya quedó informado: nunca más avisos
  setExactAlarmInviteVisible(false)
  dispatch(START)                                  // la sesión arranca ANTES de irse a Ajustes
  openExactAlarmSettings()                         // pantalla del sistema (mejor esfuerzo)

handleExactAlarmSkip:                             // «Ahora no» (RF-14)
  await setExactAlarmInvitationSeen()              // primero: nunca se vuelve a invitar
  si !await hasInformedExactAlarmRisk():
    Alert.alert('El aviso puede no ser puntual', 'Sin «Alarmas y recordatorios» el aviso puede llegar tarde o no llegar a la hora exacta. El temporizador sigue funcionando.')
    await setExactAlarmRiskInformed()
  setExactAlarmInviteVisible(false)
  dispatch(START)                                  // nunca se bloquea el temporizador (RF-14)

handleAlarmStop:                                   // botón «Detener» (RF-7)
  await dismissAllNotificationsAsync()             // corta sonido y vibración
  setAlarmVisible(false)                           // debajo queda «Fase terminada»
```

## 5. Cómo se pinta en la interfaz

- **Vista de alarma en primer plano** — `src/components/PhaseEndAlarm.tsx`
  *(RF-6, RF-7, RNF-2)*: pantalla superpuesta (`Modal` sin dismiss por
  backdrop ni gesto: es un aviso, no un diálogo) con el texto «Fase
  terminada», la etiqueta de la fase cumplida y un botón grande «Detener».
  Identidad Cotopaxi: fondo Blanco Nieve, texto Azul Marino semibold (AA >
  4.5:1), botón Azul Marino con texto Blanco Nieve, dorado solo como acento;
  sin Dorado en texto, sin gradientes ni animaciones (`cotopaxi-brand`).
  Accesibilidad (`rn-conventions`): `accessibilityRole="button"` y label
  «Detener aviso». Textos en español.
- **Estado «Fase terminada» subyacente** *(RF-8)*: el de 003 («Fase terminada»
  + «Iniciar siguiente») queda visible al detener la alarma y al abrir desde la
  notificación. Con la unificación del RF-6, este estado ya no es exclusivo de
  «app cerrada»: también aparece al terminar la fase en primer plano.
- **Modal de explicación de permiso** — `src/components/PermissionExplainer.tsx`
  *(RF-10)*: texto corto en español («Necesitamos poder avisarte cuando termine
  el tiempo, aunque la app esté cerrada o el celular en silencio»), botón
  «Continuar» que dispara el diálogo del sistema. No se muestra nunca si el
  permiso ya se pidió (RF-11).
- **Modal de invitación a «Alarmas y recordatorios»** —
  `src/components/ExactAlarmExplainer.tsx` *(RF-13, RF-14, RNF-2)*: mismo patrón
  visual que `PermissionExplainer` (identidad Cotopaxi: tarjeta sobre Blanco
  Nieve, texto Azul Marino AA, dorado solo como acento, `animationType="none"`,
  sin cierre por backdrop ni gesto, textos en español, `rn-conventions`) con dos
  botones: «Abrir ajustes» (primario, Azul Marino) y «Ahora no» (secundario).
  Texto propuesto: «"Alarmas y recordatorios" hace que el aviso suene a la hora
  exacta, aunque la app esté cerrada. Si ya está activado, no cambia nada.» No
  se muestra nunca si la invitación ya se mostró (RF-14) ni en iOS/Android < 12.
- **Notificación** *(RF-2, RF-3, RF-12)*: título «Fin de fase», cuerpo con la
  etiqueta de la fase, sonido por defecto del sistema, vibración del canal de
  alarma y botón «Detener» (categoría `phase-end`) en la vista expandida.
- **iOS** *(RF-5)*: sin cambios forzados; el sistema decide sonido/pantalla. La
  limitación ya está documentada en la spec.
- **Sin conexión** *(RNF-1)*: todo es local (`expo-notifications` + AsyncStorage);
  ningún código nuevo toca la red.

## 6. Decisiones técnicas justificadas

1. **Unificar el fin de fase en primer plano con `awaitingNextPhase`.** RF-6
   exige «mostrar en pantalla la fase terminada» y la decisión 3 pide «un solo
   camino de comportamiento en todas las situaciones»; la decisión 10 ya fija
   que la fase terminada se muestra antes de iniciar la siguiente. *Descartado:*
   mantener el auto-avance de 002 en primer plano (mostraría la SIGUIENTE fase,
   no la terminada, y duplicaría el comportamiento que RF-8 describe al abrir
   desde el aviso). Consecuencia honesta: los casos de 002 que asumían
   auto-avance en primer plano se actualizan como regresión deliberada.
2. **Canal de alarma Android con `audioAttributes.usage = ALARM`, no un canal
   de notificación normal.** Es la única vía JS para sonar en modo silencio
   (stream de alarma; decisión 1) y `expo-notifications` la expone
   (`NotificationChannelInput.audioAttributes`). *Descartado:* canal por
   defecto «Miscellaneous» (stream de notificación: silenciado en modo
   silencio) o un tono propio (decisión 8, fuera de alcance).
3. **RF-4 en máximo alcanzable: heads-up de importancia máxima en pantalla de
   bloqueo + vista de alarma en primer plano; sin full-screen intent.**
   Verificado en el SDK 57: `expo-notifications` no expone `fullScreenIntent`
   en su API JS, y pedir `USE_FULL_SCREEN_INTENT` viola RNF-3 (solo se permite
   pedir el permiso de notificaciones). La importancia MAX + categoría alarma +
   `lockscreenVisibility: PUBLIC` entrega «el aviso en la pantalla de
   bloqueo» (RF-3) con el máximo impacto disponible. *Descartado:* código
   nativo vía development build (fuera del stack autorizado hoy; queda como
   evolución si aparece un development build) y pedir el permiso especial
   (RNF-3 lo prohíbe). **Confirmado por el usuario en la fase de plan.**
4. **El «botón de detener» del RF-7 vive en dos places y converge en un único
   camino:** acción «Detener» en la notificación (vista expandida/bloqueo) y
   botón de la vista de alarma en primer plano; ambos ejecutan
   `dismissAllNotificationsAsync()` y dejan la app mostrando la fase terminada
   (idéntico al RF-8, como pide el RF-7 corregido). *Descartado:* un solo
   botón (dejaría sin detener al alumno con el celular bloqueado) o una tercera
   ruta nativa.
5. **La ráfaga de 30 s (RF-9, decisión 9) se cumple con el tono por defecto
   finito del sistema.** El sonido de una notificación dura segundos y para
   sola —dentro del límite de 30 s—; no hay API para prolongarlo ni para
   cortarlo a los 30 s exactos, y la notificación NO es `ongoing`, así que
   permanece en la bandeja hasta que se atienda. *Descartado:* reproducir un
   audio con `expo-av` en bucle 30 s (dependencia nueva, principio 1, y
   contradice la decisión 8).
6. **El flujo de permiso es lógica pura en `src/domain/permission.ts`.** La
   matriz (concedido / pedido / informado) es una decisión de negocio
   testeable sin React ni AsyncStorage (principio 3). *Descartado:* la lógica
   incrustada en el handler del botón (improbable sin dispositivo, principio 4).
7. **Se elimina el `Alert` de arranque de 003 (RF-11 unificado).** RF-10 exige
   que la app explique el permiso ANTES de pedirlo y RF-11 que se informe una
   sola vez; un alert al montar habla de «activar en Ajustes» antes de que la
   app haya pedido nada y duplicaría la información. La información única pasa
   al flujo del primer «Iniciar», en contexto, reutilizando el mismo flag
   persistido. *Descartado:* mantener ambos avisos (dos mensajes para el mismo
   hecho, ruidoso).
8. **La vista de alarma es estado efímero de UI, no estado del ciclo.**
   `alarmVisible` vive en `useState` y solo se enciende cuando la fase termina
   en primer plano en ESTA sesión: quien reabre la app con la fase ya
   terminada (camino 003) ve «Fase terminada» sin alarma. *Descartado:*
   derivarla de `awaitingNextPhase` (encendería la alarma al reabrir horas
   después).
9. **Invitación única a «Alarmas y recordatorios» con `Linking.sendIntent` y dos
   flags, sin dependencias y sin API de detección.** RF-13/RF-14 y decisión 11:
   verificado en el SDK 57 que `expo-notifications` y `expo-modules-core` **no
   exponen** `canScheduleExactAlarms()` (solo lo comprueba en nativo
   `ExpoSchedulingDelegate.kt`, con caída silenciosa a alarma inexacta — la
   causa raíz de T8), así que el estado real no es legible desde JS: la
   invitación se muestra **una sola vez por instalación** y su texto cubre el
   caso «ya estaba activo». La pantalla del sistema se abre con
   `Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM')`:
   integrado en React Native (**cero dependencias**, principio 1) y el manifiesto
   del proyecto gana `SCHEDULE_EXACT_ALARM` en `app.json` para el development
   build (en Expo Go rige el de Expo Go, ya declarado — verificado en T8).
   *Descartado:* `expo-intent-launcher` (dependencia nueva), `USE_EXACT_ALARM`
   (permiso de concesión automática reservado por política a apps de reloj y
   además exige development build) y un módulo nativo propio para detectar el
   estado (fuera del stack autorizado). La degradación al no activarlo conserva
   el mejor esfuerzo de la decisión 7, condicionada por la 11.

## 7. Estrategia de pruebas con Jest

Archivos: `permission.test.ts` (nuevo), `cycle.test.ts` (extendido/ajustado),
`notifications.test.ts` (extendido), `cycleStorage.test.ts` (extendido) e
`index.test.tsx` (extendido). Reloj fijo inyectado (`t0 = 1_700_000_000_000`)
y fake timers donde ya se usan. Matriz casos → RF:

| Caso | RF |
|---|---|
| `resolveNotificationPermissionAction` con `enabled` → `'start'` | RF-10 |
| `resolve…` con `!enabled && !asked` → `'explain'` (primera vez) | RF-10 |
| `resolve…` con `!enabled && asked && !informed` → `'inform-once'` | RF-11 |
| `resolve…` con `!enabled && asked && informed` → `'silent'` (nunca más) | RF-11 |
| `tickCycle` con `running` vencido en primer plano → `awaitingNextPhase`, fase intacta, contador +1 (ANTES auto-avanzaba: regresión ajustada) | RF-6, RF-9 |
| `tickCycle` con 4.º estudio vencido en primer plano → contador a 4, `startNextPhase` → `longBreak` con cero atómico | RF-6 |
| `tickCycle` con `running` no vencido / pausado / idle → mismo comportamiento que 003 (identidad o refresco) | RF-6 |
| `notifications`: `configureAlarmChannel` llama al canal con `usage: ALARM`, `importance: MAX`, `sound: 'default'` y vibración | RF-3, RF-12 |
| `notifications`: handler con `shouldPlaySound: true` | RF-2, RF-6 |
| `notifications`: el aviso se programa en el canal `phase-alarm` con `categoryIdentifier: 'phase-end'` | RF-2, RF-3, RF-7 |
| `notifications`: respuesta con `actionIdentifier: 'stop'` → `dismissAllNotificationsAsync` + callback `origen: 'detener'`; sin action → `origen: 'notificacion'` | RF-7, RF-8 |
| `cycleStorage`: `hasAskedNotificationPermission` ausente → false; tras `setNotificationPermissionAsked` → true | RF-10, RF-11 |
| `index`: primer «Iniciar» sin permiso → aparece el modal, NO arranca; «Continuar» → `requestPermissions` y arranca | RF-10 |
| `index`: «Continuar» con rechazo → informa UNA vez (flag) y arranca; segundo «Iniciar» → sin modal ni solicitud | RF-11 |
| `index`: con permiso concedido → «Iniciar» arranca sin modal | RF-10 |
| `index`: fin de fase en primer plano (ticks hasta 00:00) → «Fase terminada», «Iniciar siguiente» y vista de alarma visible | RF-6 |
| `index`: «Detener» → desaparece la vista de alarma y `dismissAllNotificationsAsync` llamado | RF-7 |
| `index`: respuesta del listener (tocado desde fuera) → RESUME y «Fase terminada» SIN vista de alarma | RF-8 |
| `permission`: `resolveExactAlarmInvitationAction` con `!supported` → `'silent'` (iOS o Android < 12) | RF-13 |
| `permission`: `resolve…` con `!enabled` → `'silent'` (sin notificaciones: manda RF-11) | RF-13 |
| `permission`: `resolve…` con `enabled && !invited` → `'invite'` | RF-13 |
| `permission`: `resolve…` con `invited && !informed` → `'inform-once'` y con `invited && informed` → `'silent'` (nunca más) | RF-14 |
| `cycleStorage`: flags `@pomodoro/exact-alarm-invited` e `@pomodoro/exact-alarm-informed`: ausentes → false, tras los setters → true, claves exactas e independientes de los de 003 | RF-13, RF-14 |
| `notifications`: `openExactAlarmSettings` llama a `Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM')`; si la promesa rechaza, no propaga el error (no rompe el arranque) | RF-13 |
| `index`: Android ≥ 31 + notificaciones concedidas + sin invitar → primer «Iniciar» muestra la invitación y NO arranca hasta elegir | RF-13 |
| `index`: «Abrir ajustes» → arranca, `openExactAlarmSettings` llamado y los dos flags persistidos; «Ahora no» → informe UNA vez (flag) y arranca | RF-13, RF-14 |
| `index`: segunda sesión → sin invitación ni informe; iOS/Android < 12 o sin notificaciones → sin invitación | RF-13, RF-14 |
| `index`: tras «Continuar» concedido en el modal de notificaciones → cadena explicación → invitación → arranque | RF-10, RF-13 |
| Regresión: `timer.test.ts` y los casos de 003 de `cycle.test.ts`/`index.test.tsx` en verde salvo los de auto-avance en primer plano (ajustados deliberadamente) | RF-9 |

> **Nota de pruebas:** para las de invitación se fija `Platform.OS = 'android'` y
> `Platform.Version >= 31` (el preset de Jest de React Native arranca en
> `'ios'`); los casos iOS/Android < 12 prueban el `'silent'` de
> `resolveExactAlarmInvitationAction`.

`src/notifications/notifications.ts` sigue verificándose con el mock oficial
de `expo-notifications`; la entrega REAL del aviso (sonido en silencio,
pantalla de bloqueo, app cerrada) es **manual**, con el matiz de la decisión 5
de 003: en Expo Go se cubre lo que el entorno permite y lo demás en un
development build cuando haya uno.

**Verificación manual en Expo Go (principio 4, criterios de la spec):** los
cuatro escenarios de HU-004 — (1) celular en sonido: al llegar a cero suena,
vibra y aparece la notificación con la fase; (2) silencio/vibración: suena
como alarma (Android, stream de alarma) y la notificación aparece en la
pantalla de bloqueo; (3) detener: tocando la notificación, tocando «Detener»
en la vista de alarma o en la notificación, el aviso calla y la app muestra la
fase terminada con «Iniciar siguiente»; (4) permiso: primer «Iniciar» sin
permiso muestra la explicación y luego el diálogo del sistema; rechazar deja
el temporizador funcionando, informa una vez y no vuelve a preguntar.

## 8. Fuera de alcance (no se toca aquí)

- Full-screen intent nativo (decisión técnica 3; requiere development build y
  una nueva decisión que lo autorice).
- Repetir o posponer la alarma (snooze) — decisión 4; prohibido.
- Cambios en la optimización de batería — decisión 7; prohibido (RNF-3).
- Volver a invitar a «Alarmas y recordatorios» o insistir tras el rechazo —
  RF-13/RF-14 y decisión 11: una sola invitación por instalación y un solo
  informe.
- Garantizar la puntualidad del aviso sin el permiso de alarmas exactas —
  límites del sistema; RF-14 asume la degradación honesta.
- `USE_EXACT_ALARM` o módulo nativo para leer `canScheduleExactAlarms()` —
  requiere development build y política de tienda; fuera del stack autorizado
  (decisión técnica 9).
- Tonos de alarma propios o assets de audio — decisión 8; prohibido.
- Sonido forzoso y despertador en silencio en iOS — decisiones 1 y 2; límite
  del sistema documentado (RF-5).
- Cambios de paleta, modo oscuro o identidad — principio 7; prohibido.
