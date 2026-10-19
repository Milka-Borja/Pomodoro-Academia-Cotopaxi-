# Plan — Spec 001: Iniciar y controlar una sesión de estudio

Spec: `specs/001-iniciar-sesion/spec.md` (Estado: **Aprobada**, sin dudas abiertas).
Decisiones: `specs/001-iniciar-sesion/decisiones.md` (Decisión 1–12, todas cerradas).
Base: `docs/constitution.md`, `AGENTS.md`, skills `pomodoro-rules` y `cotopaxi-brand`.
Cobertura: RF-1 a RF-12, RNF-1 y RNF-2. Cada sección indica qué RF cubre.

---

## 1. Archivos que se crean o modifican

| Archivo | Acción | Responsabilidad | RF |
|---|---|---|---|
| `src/domain/timer.ts` | Crea | Lógica pura del temporizador: tipos del estado, constantes (25 min por defecto) y funciones de transición (iniciar, pausar, reanudar, reiniciar, cancelar, tick, restante, formato mm:ss, etiqueta del botón). Sin React, sin AsyncStorage, sin `Date.now()` interno. | RF-1 a RF-10, RF-12 |
| `src/domain/__tests__/timer.test.ts` | Crea | Pruebas Jest de toda la lógica pura con marcas de tiempo fijas (reloj inyectado). Puerta de la constitución (principio 4). | RF-1 a RF-12 |
| `src/theme/colors.ts` | Crea | Paleta institucional como única fuente de verdad (Azul Marino `#1B1D5D`, Dorado `#C89B1E`, Blanco `#FFFFFF`, gris neutro para bordes). Impide improvisar colores (skill `cotopaxi-brand`). | RNF-2 |
| `app/_layout.tsx` | Crea | Layout raíz de Expo Router: fondo blanco, `StatusBar` en tono oscuro, tipografía por defecto sans-serif. | RNF-2 |
| `app/index.tsx` | Crea | Pantalla principal: cuenta regresiva mm:ss, botón alterno «Iniciar»/«Pausar»/«Reanudar», botón «Reiniciar» y diálogo nativo de confirmación. Orquesta el estado con `useReducer` delegando en el dominio; refresca la vista con un intervalo y con `AppState`. | RF-1 a RF-12, RNF-2 |
| `package.json` | Modifica | Añadir el bloque `"jest": { "preset": "jest-expo" }` (y script `"test": "jest"`) para que `npx jest` funcione con TypeScript. `jest-expo` ya está instalado: **cero dependencias nuevas** (principio 1). | — |
| `MEMORY.md` | Modifica | Al terminar la fase, actualizar solo «Estado actual» y «Próximos pasos» (siguiente: `/sdd-tasks 001-iniciar-sesion`). | — |

**No se crea ni se usa `src/storage/`:** la persistencia y la restauración del estado tras cierre quedan fuera de alcance (Decisión 3). `@react-native-async-storage/async-storage` no se toca en esta historia.

## 2. Funciones puras de lógica (`src/domain/timer.ts`)

Modelo de estado (máquina de estados):

```
TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

TimerState = {
  status: TimerStatus
  durationMs: number              // tiempo inicial de estudio (25 min por defecto, Decisión 9)
  endTimestampMs: number | null   // marca absoluta de fin, solo en 'running' (Decisión 8)
  pausedRemainingMs: number | null // restante congelado, solo en 'paused'
}
```

Funciones exportadas (todas puras: reciben el estado y `nowMs` como parámetro; jamás leen el reloj del sistema):

- `createInitialTimerState(durationMs = DEFAULT_STUDY_DURATION_MS): TimerState` — estado `idle` a 25:00 detenido. *(RF-1, RF-9)*
- `start(state, nowMs): TimerState` — desde `idle` comienza la cuenta con `endTimestampMs = nowMs + durationMs`; desde `paused` continúa desde `pausedRemainingMs`; desde `finished` (00:00) vuelve al tiempo inicial y corre automáticamente. Si ya está `running`, no hace nada. *(RF-1, RF-4, RF-7)*
- `pause(state, nowMs): TimerState` — desde `running` congela el restante exacto (`endTimestampMs − nowMs`) y pasa a `paused`; si el tiempo ya venció, pasa a `finished` (pausar en 00:00 no hace nada). *(RF-3, caso límite)*
- `cancelReset(state): TimerState` — devuelve el mismo estado sin ningún cambio (deja explícito y testeable el «cambiar de opinión»). *(RF-10)*
- `confirmReset(state, nowMs): TimerState` — si el restante en `nowMs` es 0, vuelve al tiempo inicial **y arranca** una nueva ronda; si no, vuelve al tiempo inicial **detenido** (`idle`). *(RF-9, RF-12)*
- `tick(state, nowMs): TimerState` — si está `running` y `nowMs ≥ endTimestampMs`, pasa a `finished` (clava el conteo); si no, devuelve el mismo estado. *(RF-6)*
- `getRemainingMs(state, nowMs): number` — `running`: `max(0, endTimestampMs − nowMs)`; `paused`: `pausedRemainingMs`; `idle`: `durationMs`; `finished`: `0`. Nunca negativo. *(RF-2, RF-5, RF-6)*
- `formatMmSs(remainingMs): string` — mm:ss con dos dígitos, redondeando hacia abajo y con mínimo `00:00`. *(RF-2, RF-6, Decisión 7)*
- `getPrimaryButtonLabel(state): string` — `running` → «Pausar»; `paused` → «Reanudar»; `idle`/`finished` → «Iniciar». *(RF-11)*
- Constante `DEFAULT_STUDY_DURATION_MS = 25 * 60 * 1000` (fuente: skill `pomodoro-rules`, Decisión 9). Cuando HU-005 agregue ajustes, solo cambia la fuente del dato.

`src/domain` no importa React ni AsyncStorage (principio 3).

## 3. Persistencia

**Ninguna en esta historia.** El estado de la sesión vive solo en memoria del componente (`useReducer`). Al cerrar o forzar el cierre de la app, el estado se pierde y al reabrir vuelve a 25:00 detenido, comportamiento explícitamente aceptado por la Decisión 3 y por el «Cerrar o forzar el cierre» de la spec. Guardar «por si acaso» sería implementar fuera de la spec (principio 2) y usar el formato de datos guardados sin decisión aprobada (AGENTS.md). El módulo `src/storage/` queda reservado para la historia futura de persistencia. *(RF-6, RNF-1)*

## 4. Algoritmo en pseudocódigo

Dominio (núcleo del cálculo):

```
funcion getRemainingMs(estado, ahora):
  si estado.status == 'running':  retornar max(0, estado.endTimestampMs - ahora)
  si estado.status == 'paused':   retornar estado.pausedRemainingMs
  si estado.status == 'finished': retornar 0
  retornar estado.durationMs                        // idle

funcion start(estado, ahora):
  si estado.status == 'paused':
    retornar { running, durationMs, endTimestampMs: ahora + estado.pausedRemainingMs }
  si estado.status == 'running':
    retornar estado                                  // no-op
  retornar { running, durationMs, endTimestampMs: ahora + durationMs }   // idle o finished (RF-7)

funcion confirmReset(estado, ahora):
  si getRemainingMs(estado, ahora) == 0:             // contador en 00:00 → RF-12
    retornar { running, durationMs, endTimestampMs: ahora + durationMs }
  retornar { idle, durationMs, endTimestampMs: null }  // RF-9: detenido, espera «Iniciar»

funcion tick(estado, ahora):
  si estado.status == 'running' y ahora >= estado.endTimestampMs:
    retornar { finished, durationMs, endTimestampMs: null }  // RF-6: clava en 00:00
  retornar estado
```

Pantalla (`app/index.tsx`):

```
estado = useReducer(timerReducer, createInitialTimerState())
reducer(estado, accion):
  accion = { tipo: 'INICIAR' | 'PAUSAR' | 'REINICIAR' | 'CANCELAR_REINICIO' | 'TICK', ahora: number }
  INICIAR           -> start(estado, accion.ahora)
  PAUSAR            -> pause(estado, accion.ahora)
  REINICIAR         -> confirmReset(estado, accion.ahora)
  CANCELAR_REINICIO -> cancelReset(estado)
  TICK              -> tick(estado, accion.ahora)

al montar:
  cada 250 ms: dispatch({ tipo: 'TICK', ahora: Date.now() })       // solo refresca la vista
  AppState 'active': dispatch({ tipo: 'TICK', ahora: Date.now() }) // RF-5 al volver

pantalla:
  restante = formatMmSs(getRemainingMs(estado, Date.now()))
  botón principal: etiqueta = getPrimaryButtonLabel(estado)
                   al pulsar: dispatch INICIAR si no corre, PAUSAR si corre   // RF-11
  botón «Reiniciar»: Alert.alert('¿Reiniciar el temporizador?',
                      [ { texto: 'Cancelar',  onPress: dispatch CANCELAR_REINICIO },   // RF-10
                        { texto: 'Reiniciar', onPress: dispatch REINICIAR } ])         // RF-9 / RF-12
  // El diálogo NO pausa ni congela nada: la cuenta sigue su marcha por timestamp (RF-8)
```

El intervalo de 250 ms **no calcula el tiempo**, solo provoca re-render; el valor correcto sale siempre de `endTimestampMs` (Decisión 8), por eso el conteo es exacto aunque el intervalo se pause en segundo plano.

## 5. Cómo se pinta en la interfaz

Pantalla única, minimalista (Decisión 7, RF-11): sin etiqueta de fase, sin contador de pomodoros.

- **Fondo:** Blanco Nieve `#FFFFFF` (`app/_layout.tsx`), para evitar fatiga visual (skill `cotopaxi-brand`).
- **Cuenta regresiva:** `Text` grande, sans-serif, Azul Marino `#1B1D5D` sobre blanco (contraste ≫ 4.5:1, WCAG AA). Ocupa el centro de la pantalla. *(RF-2)*
- **Botón alterno:** fondo Azul Marino `#1B1D5D` con texto Blanco `#FFFFFF` (combinación validada por la skill). Etiqueta dinámica «Iniciar»/«Pausar»/«Reanudar». *(RF-11)*
- **Botón «Reiniciar»:** acción secundaria con fondo Dorado `#C89B1E` y texto Azul Marino `#1B1D5D` (el Dorado es el acento institucional permitido para acciones secundarias; nunca texto Dorado sobre blanco). *(RF-8, RNF-2)*
- **Diálogo:** `Alert.alert` nativo con «Cancelar» y «Reiniciar». No se detiene nada al abrirlo; «Cancelar» no aplica ningún cambio (RF-8, RF-10, RF-11).
- Sin gradientes, sin animaciones decorativas, sin modo oscuro (prohibiciones de `cotopaxi-brand`).

## 6. Decisiones técnicas justificadas

1. **Marcas de tiempo absolutas (`endTimestampMs`) en vez de decrementar un contador con `setInterval`.** Exactitud con app en segundo plano o celular bloqueado (Decisión 8, RF-5, principio 6). *Descartado:* `restante -= 1000` por tick: deriva con la frecuencia real del intervalo y cuenta mal tras el bloqueo.
2. **Reloj inyectado (`nowMs` como parámetro), sin `Date.now()` dentro del dominio.** Pura (principio 3) y testeable de forma determinista con timestamps fijos. *Descartado:* usar `Date.now()`/`jest.useFakeTimers()` dentro del dominio: tests frágiles y acoplados al reloj del sistema.
3. **Cero persistencia en esta historia** (Decisión 3, sección 3). *Descartado:* persistir estado «por implementación preventiva»: fuera de spec (principio 2) y define un formato de datos guardado sin decisión aprobada.
4. **Diálogo nativo `Alert.alert`** (Decisión 6): sin dependencias nuevas y no interfiere con la cuenta en marcha (RF-8). *Descartado:* modal personalizado con `Modal`/componente propio: más código y riesgo de congelar o capturar el estado del temporizador.
5. **Reducer delgado en la pantalla que delega en funciones puras del dominio.** Un único punto de transición, testable sin renderizar React. *Descartado:* lógica repartida en varios `useState` dentro del componente: no se prueba con Jest sin UI y mezcla interfaz con reglas (viola principio 3).
6. **Un solo archivo de dominio `src/domain/timer.ts`** con tipos, constantes y funciones (Simplicidad primero, principio 1; la spec es una sola fase). *Descartado:* árbol de carpetas por entidades/ciclo: los ciclos y descansos llegan en historias futuras; ahora sería estructura prematura.
7. **`src/theme/colors.ts` como fuente única de la paleta** (RNF-2, principio 7). *Descartado:* colores incrustados en cada `StyleSheet`: duplica valores y facilita improvisar colores prohibidos.
8. **Intervalo de refresco de 250 ms solo para repintar** (el cálculo es por timestamp). *Descartado:* 1000 ms exactos: puede mostrar hasta ~1 s de retraso visual en el cambio de segundo; el cálculo no se degrada con 250 ms porque no depende del tick.
9. **Configurar Jest con el preset `jest-expo` ya instalado** (modificación de `package.json`, cero dependencias nuevas). *Descartado:* `ts-jest` o presets manuales: dependencia nueva (principio 1) o configuración más frágil.
10. **Tests Jest solo de lógica; interfaz verificada con la lista manual en Expo Go** (principio 4). *Descartado:* tests de render con Testing Library en esta historia: duplican la lista manual, añaden fragilidad y la constitución asigna la verificación de interfaz a la lista manual.

## 7. Estrategia de pruebas con Jest

Archivo: `src/domain/__tests__/timer.test.ts`. Reloj fijo inyectado (`t0 = 1_700_000_000_000`), sin fake timers. Matriz casos → RF:

| Caso | RF |
|---|---|
| Estado inicial: `idle`, 25:00, `getRemainingMs` = 25 min | RF-1, RF-9 |
| `start` desde `idle`: `endTimestampMs = ahora + 25 min`; el restante baja de forma exacta | RF-1 |
| `formatMmSs`: `25:00`, `05:01`, `00:09`, `00:00` para 0 o negativo; siempre dos dígitos | RF-2, RF-6 |
| `pause` congela el restante exacto en el instante de la pulsación | RF-3 |
| `start` desde `paused` continúa desde el tiempo congelado (no desde el inicio) | RF-4 |
| Exactitud con bloqueo: sin ningún tick intermedio, `getRemainingMs` con `ahora = t0 + 10 min` da exactamente 15:00 (simula app en segundo plano/pantalla bloqueada) | RF-5 |
| `tick` con `ahora ≥ endTimestampMs` → `finished`, restante 0, jamás negativo; `start` desde `finished` inicia ronda nueva al tiempo inicial | RF-6, RF-7 |
| La cuenta sigue avanzando durante el diálogo: estado sin tocar entre apertura y cancelación + restante calculado con un `ahora` posterior ya avanzó | RF-8 |
| `confirmReset` con contador > 0 (corriendo y pausado) → `idle` al tiempo inicial, detenido | RF-9 |
| `cancelReset` devuelve el mismo estado (identidad) | RF-10 |
| `getPrimaryButtonLabel`: «Pausar»/«Reanudar»/«Iniciar» según estado | RF-11 |
| `confirmReset` con restante 0 (venía corriendo o pausado en 00:00) → tiempo inicial corriendo automáticamente | RF-12 |

Sin dependencias nuevas: `jest` y `jest-expo` ya están en `devDependencies` (RNF-1, principio 1).

**Verificación manual de interfaz (Expo Go):** los cuatro escenarios de HU-001 en el dispositivo; bloquear la pantalla 1–2 minutos con la cuenta corriendo y comprobar el valor exacto al volver (RF-5); llegar a 00:00 y verificar clavado sin negativos y nuevo arranque con «Iniciar» (RF-6, RF-7); abrir el diálogo con la cuenta corriendo y confirmar que sigue descontando detrás (RF-8).

## 8. Checklist de la skill `pomodoro-rules` aplicable a esta historia

- Cálculo por diferencia de timestamps absolutos para simular bloqueos: **sí, aplicado** (Decisión 8, RF-5) y probado en la tabla anterior.
- Nunca números negativos: **sí, aplicado** (`getRemainingMs` con `max(0, …)` + `finished` en 00:00, RF-6).
- Transición a Descanso Largo, contador de pomodoros, validaciones de ajustes y cambio de tiempos en caliente: **no aplican** a esta historia (fuera de alcance: Decisión 1, Decisión 2, HU-005); quedarán cubiertos por specs futuras.

## 9. Fuera de alcance (no se toca aquí)

- Transición automática de fase, descansos, notificaciones y avisos (Decisiones 1, 2, 8; HU-002/003/004).
- Ciclo de pomodoros y contador (Decisión 2).
- Persistencia y restauración tras cierre (Decisión 3) → `src/storage/`.
- Pantalla de ajustes (HU-005).
