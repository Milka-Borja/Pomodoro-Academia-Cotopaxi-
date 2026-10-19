# Plan — Spec 003: Mantener el conteo con el celular bloqueado o la app cerrada

Spec: `specs/003-app-cerrada/spec.md` (Estado: **aprobada**, sin dudas abiertas).
Decisiones: `specs/003-app-cerrada/decisiones.md` (Decisión 1–8, todas cerradas).
Base: `docs/constitution.md`, `AGENTS.md`, skills `pomodoro-rules`, `cotopaxi-brand` y `rn-conventions`.
Cobertura: RF-1 a RF-12 y RNF-1. Cada sección indica qué RF cubre.

> **Scoping clave heredado de 002 (sin contradicción con RF-6):** cuando una fase
> termina **en primer plano** (el usuario ve el 00:00), `tickCycle` de 002 deja la
> siguiente fase lista detenida (comportamiento aprobado). RF-6 aplica solo cuando
> la fase se cumplió **con la app cerrada o en segundo plano** («CUANDO el usuario
> abre la app después de que una fase se cumplió con la app cerrada»). Los dos
> caminos son distintos y coexisten: ver decisión técnica 2.

---

## 1. Archivos que se crean o modifican

| Archivo | Acción | Responsabilidad | RF |
|---|---|---|---|
| `src/domain/cycle.ts` | Modifica | Añade el estado «fase terminada esperando acción» (`awaitingNextPhase`), su detección al volver (`detectPhaseEndWhileAway`), la extracción de la transición 002 a `advanceToNextPhase` (sin cambiar su comportamiento), el arranque de la siguiente fase (`startNextPhase`), una guardia en `tickCycle` y la etiqueta del botón en ese estado. Sigue siendo 100 % puro, sin React ni AsyncStorage, con `nowMs` inyectado. | RF-6, RF-7, RF-8, RF-9, RF-12 |
| `src/storage/sessionCodec.ts` | Crea | Codec **puro** (sin importar AsyncStorage): serializa y parsea/valida un `CycleState` a/desde JSON. Si el JSON es corrupto o inválido devuelve `null` (fallback seguro). | RF-2, RF-12 |
| `src/storage/cycleStorage.ts` | Crea | Envuelve AsyncStorage: `loadCycleState` / `saveCycleState` (usa el codec) y el flag persistido «ya se informó que las notificaciones están desactivadas». Único punto que toca AsyncStorage. | RF-1, RF-2, RF-11, RF-12 |
| `src/notifications/notifications.ts` | Crea | Envuelve `expo-notifications`: pedir permiso, programar el aviso de fin de fase con **trigger de timestamp** (`endTimestampMs`), cancelar avisos programados y consultar si están habilitadas. Contenido en español. Módulo con efectos (fuera de `src/domain`). | RF-4, RF-5, RF-10, RF-11 |
| `app/index.tsx` | Modifica | Al montar carga la sesión y aplica la detección; al volver de segundo plano (`AppState 'active'`) despacha `RESUME` (detección) en vez de `TICK`; persiste el estado en cada cambio; pinta el estado «Fase terminada» con su botón; y un `useEffect` programa/cancela el aviso según el estado del temporizador. | RF-1 a RF-12 (capa de interfaz) |
| `src/domain/timer.ts` | **No se modifica** | Se reutiliza tal cual. `timer.test.ts` debe seguir en verde como regresión. | RF-1, RF-3, RF-9 |
| `src/theme/colors.ts` | **No se modifica** | Única fuente de verdad de la paleta (RNF de 002). | RNF |
| `package.json` | Modifica | **+1 dependencia: `expo-notifications`** (vía `npx expo install expo-notifications`). Requiere tu aprobación previa (AGENTS.md); se pide en la tarea que la introduce. Sin `expo-task-manager` (ver decisión técnica 8). | RF-4, RF-5 |
| `src/domain/__tests__/cycle.test.ts` | Modifica | Extiende las pruebas del ciclo con los nuevos comportamientos; las de 002 quedan intactas como regresión. | RF-6 a RF-9, RF-12 |
| `src/storage/__tests__/sessionCodec.test.ts` | Crea | Pruebas Jest del codec puro (sin mocks, sin AsyncStorage). | RF-2, RF-12 |
| `src/storage/__tests__/cycleStorage.test.ts` | Crea | Pruebas Jest del módulo AsyncStorage con el mock oficial de `@react-native-async-storage/async-storage`. | RF-1, RF-2, RF-11, RF-12 |
| `MEMORY.md` | Modifica | Al terminar, actualizar solo «Estado actual» y «Próximos pasos» (siguiente: `/sdd-tasks 003-app-cerrada`). | — |

## 2. Funciones puras de lógica (`src/domain/cycle.ts`)

El estado de 002 se conserva; se añade **un solo campo opcional** para que la
transición inmediata de 002 no se rompa:

```
CycleState = {
  phase: Phase                       // 'study' | 'shortBreak' | 'longBreak'
  timer: TimerState                  // delegado a timer.ts
  completedPomodoros: number
  awaitingNextPhase?: boolean        // NUEVO: fase cumplida lejos; esperando acción (RF-6)
}
```

Se lee siempre como `state.awaitingNextPhase === true` (ausente = falso), lo que
permite que los `CycleState` literales de las pruebas de 002 sigan compilando sin
tocarlas. *(base RF-6)*

Funciones existentes que cambian o se reestructuran:

- `tickCycle(state, nowMs)` — **se le añade una guardia al inicio:** si
  `awaitingNextPhase === true`, devuelve el mismo estado sin avanzar (RF-6: «no
  avanza de fase por sí sola»). El resto del comportamiento 002 queda idéntico.
  *(RF-6)*
- `advanceToNextPhase(state): CycleState` — **extracción** del cuerpo de
  transición que hoy tiene `tickCycle` tras detectar `finished` (estudio →
  descanso con contador, 4.º → descanso largo con cero atómico, descanso →
  estudio). Es la misma lógica, ahora reutilizable; `tickCycle` la llama, así que
  el comportamiento 002 no cambia (regresión). *(RF-7, RF-12)*
- `createInitialCycleState()` — pasa a incluir `awaitingNextPhase: false`. *(base RF-6)*

Funciones nuevas (todas puras, `nowMs` inyectado):

- `detectPhaseEndWhileAway(state, nowMs): CycleState` — si `awaitingNextPhase` ya
  es `true`, devuelve el estado **sin tocar el contador** (evita doble conteo).
  Si el temporizador está `running` y su `endTimestampMs` ya venció, marca
  `awaitingNextPhase: true`, conserva la fase y el temporizador (que mostrará
  00:00 por el clavado de `getRemainingMs`), y **si la fase era `study` incrementa
  `completedPomodoros`** (sin tocar el 00:00 ni el resto). En cualquier otro caso
  devuelve el mismo estado. *(RF-1, RF-2, RF-7, RF-9, RF-12; decisión 8)*
- `startNextPhase(state, nowMs): CycleState` — desde `awaitingNextPhase`, limpia
  el flag, aplica `advanceToNextPhase` (avance de fase + contador según 002) y
  luego `startCycle` para que la siguiente fase **arranque** (RF-8: «el botón para
  iniciar la siguiente»; decisión 6). Si no estaba esperando, no-op. *(RF-7, RF-8)*
- `getCyclePrimaryButtonLabel(state): string` — si `awaitingNextPhase` retorna
  `'Iniciar siguiente'`; si no, delega en `getPrimaryButtonLabel(state.timer)`.
  *(RF-6, RF-8)*
- `isPhaseEndedAwaiting(state): boolean` — predicado `state.awaitingNextPhase ===
  true` para que la UI solo consulte sin repetir la condición. *(RF-6)*

## 3. Persistencia (`src/storage/`)

**Clave y formato.** Una única clave de sesión, `@pomodoro/session`, con el
`CycleState` serializado a JSON (los timestamps son absolutos, no se guarda nada
relativo al reloj):

```
{ "phase": "study",
  "timer": { "status": "running", "durationMs": 1500000,
             "endTimestampMs": 1700001500000, "pausedRemainingMs": null },
  "completedPomodoros": 2,
  "awaitingNextPhase": false }
```

Una segunda clave, `@pomodoro/notif-informed`, guarda el flag booleano de RF-11
(«ya se informó una vez»), para que no se repita tras reiniciar la app.

- **Cuándo se guarda:** en un `useEffect` de `app/index.tsx` que observa `state`
  y llama `saveCycleState(state)` en cada cambio. El payload es diminuto y los
  timestamps ya son la fuente de verdad (decisión 1), así que no hace falta un
  guardado periódico. *(RF-2, RF-9, RF-12)*
- **Cuándo se lee:** al montar la pantalla (`useEffect` de arranque), de forma
  asíncrona: `loadCycleState()` → si hay sesión, `parse` y
  `detectPhaseEndWhileAway(stored, Date.now())`; si no hay o el JSON es inválido,
  estado inicial. *(RF-1, RF-2, RF-12)*
- **Validación al parsear** (`sessionCodec.parseStoredCycleState`): comprueba que
  `phase` sea una de las tres, que `timer.status` sea válido, que `durationMs` y
  `completedPomodoros` sean números ≥ 0, y que `endTimestampMs`/`pausedRemainingMs`
  sean `null` o números. Ante cualquier cosa rara → `null` → estado inicial (nunca
  crash). *(RF-2, RF-12)*
- **Sin migraciones por ahora:** solo existe un formato; si en el futuro cambia, se
  añade versión (queda registrado como fuera de alcance).

`src/storage/cycleStorage.ts` es el **único** archivo que importa
`@react-native-async-storage/async-storage`. `sessionCodec.ts` es puro y no lo
importa (por eso es testeable sin mocks). *(principio 3)*

## 4. Algoritmo en pseudocódigo

Dominio (`src/domain/cycle.ts`):

```
// Guardia nueva de tickCycle (RF-6): mientras se espera acción, no se avanza.
funcion tickCycle(estado, ahora):
  si estado.awaitingNextPhase == true: retornar estado        // RF-6
  t = tick(estado.timer, ahora)
  si t.status != 'finished': retornar (t == estado.timer) ? estado : { ...estado, timer: t }
  retornar advanceToNextPhase({ ...estado, timer: t })         // 002 intacto

// Extracción de la transición 002 (misma lógica de antes, reutilizable)
funcion advanceToNextPhase(estado):                            // RF-7, RF-12
  si estado.phase == 'study':
    nuevos = estado.completedPomodoros + 1
    si nuevos >= POMODOROS_PER_CYCLE:
      retornar { phase:'longBreak', timer:createInitialTimerState(15min),
                 completedPomodoros:0, awaitingNextPhase:false }
    retornar { phase:'shortBreak', timer:createInitialTimerState(5min),
               completedPomodoros:nuevos, awaitingNextPhase:false }
  retornar { phase:'study', timer:createInitialTimerState(25min),
             completedPomodoros:estado.completedPomodoros, awaitingNextPhase:false }

// Detección al volver de segundo plano / al reabrir (RF-1, RF-2, RF-6, RF-12)
funcion detectPhaseEndWhileAway(estado, ahora):
  si estado.awaitingNextPhase == true: retornar estado         // sin doble conteo
  si estado.timer.status != 'running':      retornar estado    // idle/pausado: nada (RF-9)
  si ahora < (estado.timer.endTimestampMs ?? 0): retornar estado // aún corriendo
  // La fase se cumplió mientras la app estaba cerrada/en segundo plano:
  nuevos = (estado.phase == 'study') ? estado.completedPomodoros + 1
                                     : estado.completedPomodoros   // RF-7, decisión 8
  retornar { ...estado, awaitingNextPhase: true, completedPomodoros: nuevos }
  // El temporizador queda como estaba (ya vencido → 00:00 por clavado; RF-6)

// Arranque de la siguiente fase desde el estado terminado (RF-8, decisión 6)
funcion startNextPhase(estado, ahora):
  si estado.awaitingNextPhase != true: retornar estado
  base = advanceToNextPhase({ ...estado, awaitingNextPhase: false })
  retornar startCycle(base, ahora)                              // la siguiente arranca

funcion getCyclePrimaryButtonLabel(estado):
  si estado.awaitingNextPhase == true: retornar 'Iniciar siguiente'   // RF-8
  retornar getPrimaryButtonLabel(estado.timer)
```

Almacenamiento (`src/storage/`):

```
sessionCodec.serializeCycleState(estado) -> JSON string
sessionCodec.parseStoredCycleState(raw)  -> CycleState | null   // valida; null si inválido
cycleStorage.saveCycleState(estado)      -> AsyncStorage.setItem('@pomodoro/session', codec.serialize(estado))
cycleStorage.loadCycleState()            -> codec.parse(await getItem('@pomodoro/session'))
```

Pantalla (`app/index.tsx`):

```
estado = useReducer(cycleReducer, undefined, createInitialCycleState)
reducer(estado, accion):
  accion = START | PAUSE | CONFIRM_RESET | CANCEL_RESET | TICK{ahora} | RESUME{ahora} | START_NEXT{ahora}
  START            -> startCycle(estado, ahora)
  PAUSE            -> pauseCycle(estado, ahora)
  CONFIRM_RESET    -> confirmResetCycle(estado)
  CANCEL_RESET     -> cancelResetCycle(estado)
  TICK             -> tickCycle(estado, ahora)      // solo en primer plano; guardia awaiting (RF-6)
  RESUME           -> detectPhaseEndWhileAway(estado, ahora)   // al volver de segundo plano (RF-1, RF-2, RF-6)
  START_NEXT       -> startNextPhase(estado, ahora)            // RF-8

al montar:
  cargar = await loadCycleState()
  si cargar != null: dispatch RESUME con detectPhaseEndWhileAway(cargar, Date.now())  // RF-2, RF-12
  si no: estado inicial
  cada 250 ms: dispatch({ TICK, ahora: Date.now() })          // refresco de vista
  AppState 'active': dispatch({ RESUME, ahora: Date.now() })  // ya NO TICK (RF-1, RF-6)
  addNotificationResponseReceivedListener(...)                // RF-8 (una sola pantalla)

useEffect([estado]): saveCycleState(estado)                   // persistencia

useEffect([estado.timer.status, endTimestampMs, phase, awaiting]):
  si status=='running' y awaiting!=true: scheduleEndOfPhaseNotification(phase, endTimestampMs)  // RF-4, RF-5
  si no: cancelScheduledNotifications()                       // RF-10 (pausa/reinicio/terminado)

al montar (permisos):                                         // RF-11
  si !areNotificationsEnabled() y !await cycleStorage.hasInformed():
     Alert.alert('Notificaciones desactivadas', 'Actívalas para recibir el aviso del fin de fase.')
     cycleStorage.setInformed()                               // una sola vez
```

**Por qué `RESUME` separado de `TICK`:** el intervalo de 250 ms solo refresca el
reloj en primer plano y usa `tickCycle` (comportamiento aprobado de 002). La
detección de «se cumplió mientras no estaba» solo debe ocurrir al **volver** de
segundo plano o al **montar**; si se mezclara, el TICK adelantaría la fase en
primer plano y RF-6 se rompería (decisión técnica 2).

## 5. Cómo se pinta en la interfaz

La pantalla de HU-001/002 se conserva; se añade el estado «Fase terminada» y un
cambio de etiqueta del botón:

- **Estado «Fase terminada»** *(RF-6)*: cuando `isPhaseEndedAwaiting(estado)` es
  true, sobre el reloj (que muestra `00:00` por el clavado de `getRemainingMs`)
  aparece un `Text` «Fase terminada», semibold sans-serif, Azul Marino `#1B1D5D`
  sobre Blanco Nieve (contraste > 4.5:1, WCAG AA). La etiqueta de fase actual
  («Estudio», «Descanso corto»…) se mantiene visible para que el alumno sepa en
  qué punto quedó. No se usa Dorado en texto (prohibido por `cotopaxi-brand`).
- **Botón principal** *(RF-8)*: en ese estado su texto es «Iniciar siguiente»
  (`getCyclePrimaryButtonLabel`) y al pulsarlo despacha `START_NEXT`
  (`startNextPhase`): avanza la fase según 002 y la arranca. Fuera de ese estado
  el botón y el «Reiniciar» funcionan igual que siempre (RF-9: pausado reabre
  pausado con su mismo tiempo). *(RF-6, RF-8, RF-9)*
- **Fila de puntos de avance** *(RF-7)*: si el 4.º estudio se cumplió con la app
  cerrada, `completedPomodoros` queda en 4 al detectar y la fila se pinta llena
  (4 rellenos) mientras dure el estado terminado; al pulsar «Iniciar siguiente» el
  descanso largo arranca con el contador a 0 (cero atómico de 002 intacto). No se
  toca `getPomodorosCompletados`. *(RF-7, decisión 8)*
- **Accesibilidad** (`rn-conventions`): el botón conserva `accessibilityLabel`
  («Iniciar siguiente» en ese estado); el texto de estado usa
  `accessibilityRole="text"` con `accessibilityLabel="Fase terminada"`. Todos los
  textos en español; `fontVariant: ['tabular-nums']` ya aplicado al reloj.
- **Identidad** (`cotopaxi-brand`): sin gradientes, animaciones ni modo oscuro;
  colores solo desde `src/theme/colors.ts` (Azul Marino para el texto de estado,
  Blanco Nieve de fondo). *(principio 7)*

## 6. Decisiones técnicas justificadas

1. **`awaitingNextPhase` como campo opcional en `CycleState`, no un `SessionState`
   envolvente.** Reutiliza toda la lógica de 002 y permite que los `CycleState`
   literales de `cycle.test.ts` de 002 sigan compilando sin tocarlos (regresión
   intacta, principio 4). *Descartado:* envolver `CycleState` en un nuevo tipo
   (obliga a reescribir la UI y las pruebas de 002 para un solo bit de estado).
2. **Distinguir `TICK` (primer plano, 002) de `RESUME` (vuelta de segundo plano,
   003).** RF-6 está literalmente limitado a «con la app cerrada»; el avance
   inmediato al ver el 00:00 en primer plano es el comportamiento aprobado de 002.
   *Descartado:* unificar todo el fin de fase en `awaitingNextPhase` (rompería la
   UX aprobada de 002) o, al revés, auto-avanzar siempre (rompería RF-6 y la
   decisión 2 de no avanzar sin acción).
3. **El contador de pomodoros sube al *detectar* el fin (decisión 8), permitiendo
   que sea 4 solo en el estado terminado.** Cumple literalmente «cuenta al
   detectarse». *Descartado:* clavar el contador en 3 (ocultaría el 4.º pomodoro
   completado, engañoso) o incrementarlo solo al pulsar (contradice la decisión 8).
4. **Guardia en `tickCycle` para no avanzar mientras `awaitingNextPhase`.** Sin
   ella, el intervalo de 250 ms clobberaría el estado terminado en el primer tick.
   *Descartado:* suspender el intervalo cuando se espera (más estados que mantener
   y el reloj dejaría de refrescar 00:00).
5. **Persistencia en un `useEffect` sobre `[state]`, sin guardado periódico.** El
   timestamp absoluto es la fuente de verdad (decisión 1), así que un guardado por
   timer sería redundante. *Descartado:* escribir en AsyncStorage cada N segundos
   (I/O innecesario, principio 1).
6. **Parseo con validación estricta y fallback a estado inicial ante JSON
   corrupto.** La app nunca debe crashear por un dato guardado. *Descartado:*
   confiar en el JSON (excepción al abrir) o inventar migraciones (solo hay un
   formato; se añadirán cuando exista un segundo).
7. **Programar/cancelar el aviso en un `useEffect` observando `status`,
   `endTimestampMs` y `phase`, no dentro de cada botón.** Cubre de forma uniforme
   todos los caminos (iniciar, reanudar, pausar, reiniciar, avanzar de fase) y
   hace que RF-10 (sin avisos en pausa) sea una sola condición. *Descartado:*
   llamadas dispersas en cada handler (fácil olvidar reset o el avance de fase).
8. **Solo `expo-notifications`, sin `expo-task-manager`.** Los avisos de fin de
   fase son notificaciones locales con trigger de timestamp, que
   `expo-notifications` entrega aunque la app esté cerrada; no hace falta una
   tarea en segundo plano. *Descartado:* añadir `expo-task-manager` (dependencia
   extra sin necesidad, principio 1; AGENTS.md lo lista como «ejemplo»).
9. **Aviso único de permisos desactivados con flag persistido en
   AsyncStorage** (`@pomodoro/notif-informed`). Se informa una vez y no se repite
   aunque se reinicie la app (RF-11). *Descartado:* flag solo en memoria (se
   repetiría al reabrir) o mostrar el aviso en cada fase (ruidoso, RF-11 y
   decisión 4).
10. **Codec puro separado del módulo de AsyncStorage.** `sessionCodec.ts` no
    importa AsyncStorage, así que sus pruebas no necesitan mocks;
    `cycleStorage.ts` queda como envoltorio fino y único punto con el storage
    (principio 3). *Descartado:* serialize/parse dentro de `cycleStorage.ts`
    (las pruebas del formato exigirían mockear AsyncStorage para todo).

## 7. Estrategia de pruebas con Jest

Archivos: `cycle.test.ts` (extendido), `sessionCodec.test.ts` (nuevo),
`cycleStorage.test.ts` (nuevo, con el mock oficial de AsyncStorage), más
`timer.test.ts` y los casos de 002 en `cycle.test.ts` como regresión. Reloj fijo
inyectado (`t0 = 1_700_000_000_000`), sin fake timers. Matriz casos → RF:

| Caso | RF |
|---|---|
| `detectPhaseEndWhileAway` con `running` vencido (estudio) → `awaitingNextPhase` true, fase intacta, contador +1, `getRemainingMs` = 0 | RF-6, RF-7 |
| `detectPhaseEndWhileAway` con `running` vencido (descanso) → awaiting, contador **sin** cambiar | RF-6 |
| `detectPhaseEndWhileAway` con `running` aún no vencido → mismo estado (identidad) | RF-1, RF-2 |
| `detectPhaseEndWhileAway` con `paused` (restante congelado) → mismo estado, sin contador | RF-9 |
| `detectPhaseEndWhileAway` dos veces seguidas → el contador **no** se duplica | RF-7, decisión 8 |
| 4.º estudio cumplido lejos → contador llega a 4 y la fila se pinta llena; `startNextPhase` → `longBreak` corriendo con contador 0 (cero atómico) | RF-7 |
| `startNextPhase` desde awaiting de descanso → `study` corriendo, contador intacto | RF-8 |
| `tickCycle` con `awaitingNextPhase` → devuelve el mismo estado (no avanza) | RF-6 |
| `tickCycle` sin awaiting (regresión 002) → avance inmediato igual que antes | RF-6 (scoping) |
| `getCyclePrimaryButtonLabel`: «Iniciar siguiente» en awaiting; «Pausar»/«Reanudar»/«Iniciar» fuera | RF-6, RF-8 |
| `parseStoredCycleState`: JSON válido → estado idéntico; `phase` inválida, `status` inválido, `completedPomodoros` negativo o JSON roto → `null` | RF-2, RF-12 |
| `serializeCycleState` → `parseStoredCycleState` es identidad (round-trip) | RF-2, RF-12 |
| `cycleStorage`: guarda y carga el estado con AsyncStorage mockeado; `hasInformed/setInformed` del flag de permisos | RF-1, RF-2, RF-11, RF-12 |
| Regresión: `timer.test.ts` completo y los casos de 002 de `cycle.test.ts` en verde sin tocar `timer.ts` | RF-1, RF-3, RF-9 |

`src/notifications/notifications.ts` no se prueba con Jest (envoltorio de
efectos de Expo); su verificación es manual, con el matiz de la decisión 5.

**Verificación manual en Expo Go (principio 4 y decisión 5):** los cuatro
escenarios de HU-003 — (1) bloquear el celular con estudio corriendo y ver al
desbloquear el tiempo restante exacto; (2) cerrar la app desde apps recientes,
reabrirla y ver la sesión restaurada; (3) cerrar la app, esperar a que la fase se
cumpla, reabrirla y ver «Fase terminada» con «Iniciar siguiente», y tras pulsarlo
arrancar la siguiente; (4) pausar, cerrar y reabrir: pausado con el mismo
tiempo y sin avisos. Además: **la entrega de la notificación con la app cerrada
se verifica en un development build cuando haya uno** (decisión 5), no en Expo Go.

## 8. Fuera de alcance (no se toca aquí)

- Detectar cambios manuales del reloj del dispositivo (decisión 1; limitación
  conocida, RF de casos límite).
- Garantizar el aviso de fin de fase tras un reinicio del celular (decisión 7;
  limitación aceptada, RF-12).
- Avanzar de fase sin acción explícita del usuario (decisión 2; prohibido).
- Cambio de la paleta, modo oscuro o identidad visual (principio 7; prohibido).
