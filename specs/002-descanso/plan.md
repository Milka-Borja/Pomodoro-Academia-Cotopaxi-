# Plan — Spec 002: Alternar entre estudio y descanso

Spec: `specs/002-descanso/spec.md` (Estado: **Aprobada**, sin dudas abiertas).
Decisiones: `specs/002-descanso/decisiones.md` (Decisión 1–8, todas cerradas).
Base: `docs/constitution.md`, `AGENTS.md`, skills `pomodoro-rules`, `cotopaxi-brand` y `rn-conventions`.
Cobertura: RF-1 a RF-11, RNF-1 y RNF-2. Cada sección indica qué RF cubre.

---

## 1. Archivos que se crean o modifican

| Archivo | Acción | Responsabilidad | RF |
|---|---|---|---|
| `src/domain/cycle.ts` | Crea | Lógica pura del ciclo Pomodoro: tipo `Phase`, estado `CycleState` (fase + temporizador delegado + contador de pomodoros), constantes (5 min descanso corto, 15 min largo, 4 pomodoros/ciclo) y funciones de transición (avanzar de fase, iniciar, pausar, reiniciar, cancelar, tick, etiqueta de fase, puntos de avance). Compone `src/domain/timer.ts` sin duplicar su lógica. Sin React, sin AsyncStorage, sin `Date.now()` interno. | RF-1 a RF-11 |
| `src/domain/__tests__/cycle.test.ts` | Crea | Pruebas Jest de toda la lógica pura del ciclo con marcas de tiempo fijas (reloj inyectado). Puerta de la constitución (principio 4). | RF-1 a RF-11 |
| `app/index.tsx` | Modifica | Cambia el reducer de `TimerState` por el de `CycleState` (sigue delegando en el dominio); añade la etiqueta de fase y la fila de puntos de avance sobre la pantalla de HU-001; el intervalo y `AppState` ahora despachan `tickCycle`. | RF-1, RF-2, RF-3, RF-5, RF-6, RF-7, RF-8, RF-9, RF-10 |
| `src/domain/timer.ts` | **No se modifica** | Se reutiliza tal cual (iniciar, pausar, reiniciar, cancelar, tick, restante, formato). `timer.test.ts` (30 pruebas) debe seguir en verde como regresión. | RF-5 |
| `src/theme/colors.ts` | **No se modifica** | Única fuente de verdad de la paleta; los elementos nuevos importan de aquí (RNF-2). | RNF-2 |
| `package.json` | **No se modifica** | Cero dependencias nuevas (RNF-1, principio 1). | RNF-1 |
| `MEMORY.md` | Modifica | Al terminar la fase, actualizar solo «Estado actual» y «Próximos pasos» (siguiente: `/sdd-tasks 002-descanso`). | — |

**No se crea ni se usa `src/storage/`:** persistencia y restauración tras el cierre quedan en HU-003 (Decisión 6). `@react-native-async-storage/async-storage` no se toca.

## 2. Funciones puras de lógica (`src/domain/cycle.ts`)

Modelo de estado (composición, no invención de una máquina nueva):

```
Phase = 'study' | 'shortBreak' | 'longBreak'

CycleState = {
  phase: Phase                    // fase actual
  timer: TimerState               // delegado a src/domain/timer.ts (idle | running | paused)
  completedPomodoros: number      // avance del ciclo actual (observable: 0..PER_CYCLE-1)
}
```

**Invariante central:** dentro de un `CycleState` el `timer` nunca está en `'finished'`: al detectar que una fase terminó, la app deja lista la siguiente de inmediato (Decisión 1). Esto elimina estados intermedios y casos de UI.

Constantes (fuente: skill `pomodoro-rules` y Decisión 5):

- `DEFAULT_SHORT_BREAK_DURATION_MS = 5 * 60 * 1000` *(RF-1, RF-11)*
- `DEFAULT_LONG_BREAK_DURATION_MS = 15 * 60 * 1000` *(RF-2, RF-11)*
- `POMODOROS_PER_CYCLE = 4` *(RF-2, RF-9, RF-11)*
- `PHASE_DURATIONS_MS: Record<Phase, number>` y `PHASE_LABELS: Record<Phase, string>` *(RF-8, RF-11)*

Funciones exportadas (todas puras; el reloj se inyecta como `nowMs`):

- `createInitialCycleState(): CycleState` — fase `study`, temporizador `idle` a 25:00 detenido, contador en 0. *(base de RF-1, RF-3)*
- `getPhaseDurationMs(phase): number` — duración por defecto de la fase. *(RF-11)*
- `getPhaseLabel(phase): string` — `'Estudio' | 'Descanso corto' | 'Descanso largo'`. *(RF-8)*
- `getPomodorosCompletados(completedPomodoros): boolean[]` — arreglo de `POMODOROS_PER_CYCLE` casilleros; `true` en los ya completados. Devuelve la *forma* de la fila de puntos para que la UI solo pinte. *(RF-9)*
- `tickCycle(state, nowMs): CycleState` — delega en `tick()`; si la fase terminó, aplica la transición (deja lista la siguiente fase con su tiempo completo **detenida** y actualiza el contador). Si no terminó, devuelve el mismo estado. *(RF-1, RF-2, RF-3, RF-4, RF-10)*
- `startCycle(state, nowMs): CycleState` — delega en `start()`: inicia o reanuda **cualquier fase** (estudio o descanso). *(RF-5)*
- `pauseCycle(state, nowMs): CycleState` — delega en `pause()`. *(RF-5)*
- `confirmResetCycle(state): CycleState` — vuelve al tiempo inicial de la fase actual, **detenida**, sin tocar `completedPomodoros`. No necesita `nowMs`: en ciclo nunca hay caso «reiniciar desde 00:00 → arrancar» (ver decisión técnica 3). *(RF-6, RF-7)*
- `cancelResetCycle(state): CycleState` — delega en `cancelReset()`; devuelve el mismo estado. *(RF-5)*

`src/domain/cycle.ts` no importa React ni AsyncStorage (principio 3) y no reimplementa nada ya probado en `timer.ts`.

## 3. Persistencia

**Ninguna en esta historia.** Fase, tiempo y contador viven solo en memoria (`useReducer`). Restaurar la sesión tras cierre es HU-003 (Decisión 6); guardar «por si acaso» definiría un formato de datos guardados sin decisión aprobada (AGENTS.md) y sería implementar fuera de la spec (principio 2). `src/storage/` queda reservado. *(RF-10, RNF-1)*

## 4. Algoritmo en pseudocódigo

Dominio (`src/domain/cycle.ts`):

```
DURACIONES = { study: 25min, shortBreak: 5min, longBreak: 15min }   // RF-11
ETIQUETAS  = { study: 'Estudio', shortBreak: 'Descanso corto', longBreak: 'Descanso largo' }  // RF-8

funcion createInitialCycleState():
  retornar { phase: 'study', timer: createInitialTimerState(25min), completedPomodoros: 0 }

funcion tickCycle(estado, ahora):
  t = tick(estado.timer, ahora)                        // exactitud por timestamps (RF-10)
  si t.status != 'finished':
    retornar (t == estado.timer) ? estado : { ...estado, timer: t }
  // La fase terminó: la app deja lista la siguiente, DETENIDA, esperando «Iniciar» (Decisión 1)
  si estado.phase == 'study':
    nuevos = estado.completedPomodoros + 1             // RF-4: sube al terminar el estudio
    si nuevos >= POMODOROS_PER_CYCLE:                  // RF-2: 4.º estudio completado
      retornar { phase: 'longBreak',
                 timer: createInitialTimerState(15min),   // detenido a tiempo completo
                 completedPomodoros: 0 }                  // cero AL QUEDAR LISTO el descanso largo
    retornar { phase: 'shortBreak',
               timer: createInitialTimerState(5min),
               completedPomodoros: nuevos }               // RF-1
  // phase es shortBreak o longBreak → RF-3
  retornar { phase: 'study', timer: createInitialTimerState(25min),
             completedPomodoros: estado.completedPomodoros }   // el contador NO se toca

funcion confirmResetCycle(estado):                     // RF-6, RF-7
  retornar { ...estado, timer: createInitialTimerState(DURACIONES[estado.phase]) }
  // Vuelve al tiempo inicial de la fase ACTUAL, detenido; contador intacto.

funcion startCycle(estado, ahora):  retornar { ...estado, timer: start(estado.timer, ahora) }    // RF-5
funcion pauseCycle(estado, ahora):  retornar { ...estado, timer: pause(estado.timer, ahora) }    // RF-5
funcion cancelResetCycle(estado):   retornar { ...estado, timer: cancelReset(estado.timer) }     // RF-5
```

Pantalla (`app/index.tsx`):

```
estado = useReducer(cycleReducer, undefined, createInitialCycleState)
reducer(estado, accion):
  accion = { tipo: 'INICIAR' | 'PAUSAR' | 'CONFIRMAR_REINICIO' | 'CANCELAR_REINICIO' | 'TICK', ahora }
  INICIAR            -> startCycle(estado, ahora)
  PAUSAR             -> pauseCycle(estado, ahora)
  CONFIRMAR_REINICIO -> confirmResetCycle(estado)
  CANCELAR_REINICIO  -> cancelResetCycle(estado)
  TICK               -> tickCycle(estado, ahora)       // si venció, deja lista la siguiente fase (RF-10)

al montar:
  cada 250 ms: dispatch({ tipo: 'TICK', ahora: Date.now() })        // solo refresca la vista
  AppState 'active': dispatch({ tipo: 'TICK', ahora: Date.now() })  // RF-10 al volver

pantalla:
  restante  = formatMmSs(getRemainingMs(estado.timer, Date.now()))
  etiqueta  = getPhaseLabel(estado.phase)                          // RF-8
  puntos    = getPomodorosCompletados(estado.completedPomodoros)   // RF-9: [T,T,F,F]
  botones y diálogo «Reiniciar»: idénticos a HU-001 (RF-5)
```

El intervalo de 250 ms no calcula el tiempo: el valor sale siempre de `endTimestampMs` (Decisión 6 reutiliza el mecanismo de HU-001), por eso un estudio que vence con el celular bloqueado dispara la transición correcta al volver (RF-10).

## 5. Cómo se pinta en la interfaz

La pantalla de HU-001 se mantiene; se insertan dos elementos nuevos y no se tocan los existentes:

- **Etiqueta de fase** *(RF-8)*: `Text` semibold, sans-serif, Azul Marino `#1B1D5D` sobre Blanco Nieve (contraste > 4.5:1, WCAG AA), encima del reloj. Textos: «Estudio», «Descanso corto», «Descanso largo». No se usa Dorado en el texto porque Dorado sobre blanco está prohibido por la skill `cotopaxi-brand`.
- **Fila de puntos de avance** *(RF-9, RNF-2)*: `View` horizontal con `POMODOROS_PER_CYCLE` (4) círculos pequeños (~14 px) bajo la etiqueta. Completados: relleno Azul Marino `#1B1D5D`. Pendientes: fondo Blanco Nieve con borde de 2 px en Azul Marino (el gris neutro `#E5E5E5` sobre blanco no alcanza el 3:1 exigido a componentes gráficos esenciales). Durante el descanso largo todos los puntos salen vacíos (el contador volvió a 0). *(RF-2)*
- **Reloj y controles**: sin cambios visuales de HU-001. Durante un descanso los botones funcionan igual (iniciar/pausar/reanudar/reiniciar con `Alert.alert`). *(RF-5, RF-6, RF-7)*
- **Accesibilidad** (`rn-conventions`): `accessibilityRole="text"` y etiqueta `Fase actual: <fase>` en la etiqueta; en la fila de puntos, `accessibilityLabel="Pomodoros completados: n de 4"`; los botones conservan sus `accessibilityLabel` de HU-001. Textos siempre en español.
- Sin gradientes, animaciones ni modo oscuro (prohibiciones de `cotopaxi-brand`). Colores solo desde `src/theme/colors.ts` (RNF-2).

## 6. Decisiones técnicas justificadas

1. **Módulo nuevo `src/domain/cycle.ts` que compone `timer.ts`, en vez de agrandar `timer.ts`.** El ciclo es una regla de negocio distinta del temporizador; la lógica de HU-001 queda intacta y `timer.test.ts` sigue pasando (principio 3). *Descartado:* añadir `phase` y `completedPomodoros` al `TimerState`: mezcla responsabilidades y obliga a reescribir las 30 pruebas existentes.
2. **Transición inmediata al detectar el fin de fase (invariante: nunca `finished` dentro de `CycleState`).** Cumple Decisión 1: la pantalla pasa directo a la siguiente fase con su tiempo completo detenido; el temporizador nunca muestra negativos porque `getRemainingMs` clava en 0 (principio 6). *Descartado:* pantalla intermedia de 00:00 durante N milisegundos antes de avanzar: exige un estado extra, un retardo arbitrario y no está pedido en la spec (principio 2).
3. **`confirmResetCycle` no acepta reinicio desde 00:00 que arranque solo.** Como el fin de fase avanza de inmediato, el estado `finished` no existe en el ciclo y el «arranque automático al reiniciar desde 00:00» (RF-12 de HU-001) no aplica: dentro de una fase, reiniciar siempre deja la fase **detenida** esperando «Iniciar» (RF-6, RF-7). *Descartado:* delegar a `timer.confirmReset` sin más: dispararía un arranque automático que la spec no autoriza aquí.
4. **Cero del contador atómico en la transición al descanso largo.** El 4.º estudio completado pasa directo a `completedPomodoros = 0` con el descanso largo listo; el valor 4 nunca es observable (RF-2, caso límite). *Descartado:* incrementar a 4 y luego reiniciar en un segundo paso o en «después del descanso»: mostraría «4 pomodoros» junto al descanso largo, prohibido literalmente por la spec (es la excepción validada a `pomodoro-rules`).
5. **Fila de puntos con borde Azul Marino en los pendientes, no gris neutro.** `#E5E5E5` sobre blanco tiene contraste ~1.2:1, insuficiente para un componente esencial (skill `cotopaxi-brand`, mínimo 3:1). El borde azul mantiene la paleta institucional y hace perceptible el total del ciclo. *Descartado:* puntos gris neutro (ilegibles) o íconos/emojis de librerías (dependencia nueva, principio 1).
6. **Reutilizar los controles de HU-001 sin cambios de UI** (Decisiones 3 y 8): una sola lógica de control aplicada a cualquier fase, cero código nuevo de botones. *Descartado:* ocultar o deshabilitar «Pausar» durante el descanso: viola RF-5.
7. **Etiqueta y puntos inline en `app/index.tsx` con `StyleSheet`** (patrón de HU-001, `rn-conventions`). *Descartado:* extraer componentes (`PhaseIndicator`, `PomodoroDots`) o usar una librería de UI: estructura prematura para dos elementos estáticos y dependencia nueva (principio 1).
8. **Cero persistencia y cero dependencias nuevas** (sección 3; RNF-1). *Descartado:* persistir fase/contador «preventivamente»: fuera de spec (principio 2) y define el formato de datos de HU-003 sin decisión aprobada.

## 7. Estrategia de pruebas con Jest

Archivos: `src/domain/__tests__/cycle.test.ts` (nuevo) + `src/domain/__tests__/timer.test.ts` (regresión, debe seguir en verde). Reloj fijo inyectado (`t0 = 1_700_000_000_000`), sin fake timers. Matriz casos → RF:

| Caso | RF |
|---|---|
| Estado inicial: `study`, `idle` 25:00, contador 0 | base RF-1, RF-3 |
| Estudio que termina con contador < 3 → `shortBreak` `idle` 05:00 detenido, contador +1 | RF-1, RF-4 |
| 4.º estudio que termina (contador 3) → `longBreak` `idle` 15:00 detenido, contador 0 **en la misma transición** (el 4 nunca se observa) | RF-2, RF-9 |
| Descanso corto que termina → `study` `idle` 25:00 detenido, contador **conservado** (p. ej. 1) | RF-3 |
| Descanso largo que termina → `study` `idle` 25:00, contador 0 (ciclo nuevo) | RF-3 |
| Controles en descanso: `startCycle` inicia el descanso, `pauseCycle` congela su restante exacto, reanudación continúa desde lo congelado | RF-5 |
| `confirmResetCycle` durante descanso (corriendo y pausado) → tiempo inicial del descanso detenido, contador intacto | RF-6 |
| `confirmResetCycle` durante estudio a mitad (corriendo y pausado) → 25:00 detenido, contador del ciclo intacto | RF-7 |
| `getPhaseLabel`: «Estudio» / «Descanso corto» / «Descanso largo» | RF-8 |
| `getPomodorosCompletados`: arreglo de 4; 0→[F,F,F,F], 2→[T,T,F,F] | RF-9 |
| Exactitud con bloqueo: sin ticks intermedios, `tickCycle` con `ahora = t0 + 30 min` → siguiente fase lista correctamente (estudio→descanso y descanso→estudio) | RF-10 |
| Constantes: 5 min corto, 15 min largo, 4 por ciclo (`PHASE_DURATIONS_MS` / `POMODOROS_PER_CYCLE`) | RF-11 |
| Regresión: `timer.test.ts` completo en verde sin tocar `timer.ts` | RF-5 |

Sin dependencias nuevas: `jest` y `jest-expo` ya están en `devDependencies` (RNF-1, principio 1).

**Verificación manual en Expo Go (principio 4):** los cuatro escenarios de HU-002; bloquear la pantalla con el estudio corriendo y comprobar al volver que aparece el descanso listo (RF-10); durante el descanso largo verificar etiqueta «Descanso largo», puntos vacíos y controles activos; reiniciar un descanso y un estudio a mitad y comprobar que el contador no cambia.

## 8. Checklist de la skill `pomodoro-rules` aplicable a esta historia

- Transición al Descanso Largo al terminar el 4.º pomodoro: **sí, aplicado** (`tickCycle`, RF-2) y probado en la tabla.
- El contador vuelve a cero tras el Descanso Largo: **sí, con la excepción explícita validada** — el cero ocurre al *quedar listo* el descanso largo (RF-2, Decisión 2), no después; queda registrado en la spec.
- Cálculo por diferencia de timestamps absolutos: **sí, heredado** de HU-001 y probado para el caso de segundo plano (RF-10).
- Reinicio vuelve al tiempo inicial de la fase actual conservando el progreso del ciclo: **sí, aplicado** (RF-6, RF-7).
- Nunca números negativos: **sí, heredado** (`getRemainingMs` con `max(0, …)`).
- Validaciones de ajustes y cambio de tiempos en caliente: **no aplican** (HU-005).

## 9. Fuera de alcance (no se toca aquí)

- Saltar el descanso o terminar el ciclo manualmente (Decisión 4; historia futura).
- Notificaciones y avisos al terminar una fase (HU-004).
- Persistencia y restauración de fase, tiempo y contador; exactitud con la app cerrada por completo (HU-003, Decisión 6) → `src/storage/`.
- Ajustes de tiempos y de la cantidad de pomodoros por ciclo (HU-005, Decisión 5).
