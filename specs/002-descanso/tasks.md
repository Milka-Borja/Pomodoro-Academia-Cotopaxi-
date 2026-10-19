# Tareas — Spec 002: Alternar entre estudio y descanso

Spec: `specs/002-descanso/spec.md` (Aprobada) · Plan: `specs/002-descanso/plan.md`
10 tareas en orden de dependencia. Las de lógica (T1–T7) se cierran con `npx jest` en
verde; las de interfaz (T8–T10), con puntos concretos de la lista manual de
`rn-conventions` verificados en Expo Go por el usuario.

- [x] **T1. Crear `src/domain/cycle.ts`: tipos `Phase` y `CycleState`, constantes (`DEFAULT_SHORT_BREAK_DURATION_MS`, `DEFAULT_LONG_BREAK_DURATION_MS`, `POMODOROS_PER_CYCLE`, `PHASE_DURATIONS_MS`, `PHASE_LABELS`) y `createInitialCycleState` + `getPhaseDurationMs`.** RF-11 (base de RF-1 y RF-3)
  - Hecho cuando: `npx jest` en verde con `src/domain/__tests__/cycle.test.ts`: estado inicial `phase = 'study'`, temporizador `idle` a 25:00 detenido y contador en 0; `PHASE_DURATIONS_MS` = 5 min corto / 15 min largo y `POMODOROS_PER_CYCLE` = 4; `timer.test.ts` sigue en verde sin haber tocado `timer.ts`.

- [x] **T2. `tickCycle`: fin de un estudio → descanso corto listo con el contador +1 (incluido el salto sin ticks intermedios).** RF-1, RF-4, RF-10 (dirección estudio → descanso)
  - Hecho cuando: `npx jest` en verde con: un estudio con contador < 3 que llega a 00:00 → `shortBreak` con 05:00 completo **detenido** y `completedPomodoros` en +1; sin ningún tick intermedio, `tickCycle(state, t0 + 30 min)` deja el descanso corto listo correctamente (app en segundo plano, RF-10).

- [x] **T3. Transición al descanso largo con cero atómico del contador.** RF-2
  - Hecho cuando: `npx jest` en verde con: el 4.º estudio (contador 3) que termina → `longBreak` con 15:00 completo detenido y contador 0 **en la misma transición**; una secuencia completa de 4 estudios observa contadores `[1, 2, 3, 0]` —el valor 4 nunca es observable—.

- [x] **T4. Fin de descanso (corto y largo) → siguiente estudio con el contador intacto.** RF-3, RF-10 (dirección descanso → estudio)
  - Hecho cuando: `npx jest` en verde con: descanso corto que termina → `study` con 25:00 completo detenido y contador conservado (p. ej. 1); descanso largo que termina → `study` con 25:00 detenido y contador 0 (ciclo nuevo); sin ticks intermedios, `tickCycle` con `ahora = t0 + 30 min` desde un descanso deja el estudio listo.

- [x] **T5. Controles sobre cualquier fase: `startCycle`, `pauseCycle` y `cancelResetCycle` (estudio o descanso).** RF-5
  - Hecho cuando: `npx jest` en verde con: `startCycle` inicia un descanso (fija `endTimestampMs = ahora + duración`); `pauseCycle` congela el restante exacto y la reanudación continúa desde lo congelado; `cancelResetCycle` devuelve el mismo estado (identidad); `timer.test.ts` completo sigue en verde como regresión sin tocar `timer.ts`.

- [x] **T6. `confirmResetCycle`: reinicio de la fase actual sin tocar el contador.** RF-6, RF-7
  - Hecho cuando: `npx jest` en verde con: reiniciar un descanso (corriendo y pausado) → su tiempo inicial detenido y contador intacto; reiniciar un estudio a mitad (corriendo y pausado) → 25:00 detenido y contador del ciclo intacto; ninguna ruta produce arranque automático (no existe estado `finished` dentro de `CycleState`).

- [x] **T7. Valores que se pintan: `getPhaseLabel` y `getPomodorosCompletados`.** RF-8, RF-9 (lógica)
  - Hecho cuando: `npx jest` en verde con: `getPhaseLabel` → «Estudio» / «Descanso corto» / «Descanso largo»; `getPomodorosCompletados` devuelve arreglo de 4 casilleros: 0 → [F,F,F,F], 2 → [T,T,F,F], 3 → [T,T,T,F].

- [x] **T8. `app/index.tsx`: migrar el reducer de `TimerState` a `CycleState`, despachar `tickCycle` en el intervalo de 250 ms y con `AppState 'active'`, manteniendo los controles de HU-001 sin cambios visuales.** RF-1, RF-2, RF-3, RF-5, RF-6, RF-7, RF-10
  - Hecho cuando: en Expo Go pasan los puntos de lista «Se ve bien en vertical y los elementos no se desbordan en pantallas pequeñas» y «Los textos y el reloj se leen perfectamente, respetando los contrastes de la skill `cotopaxi-brand`» (reloj y botones intactos de HU-001, `fontVariant: ['tabular-nums']`); iniciar/pausar/reanudar funcionan igual que antes; «Reiniciar» pide confirmación con el diálogo nativo `Alert.alert` (regla de acción crítica de `rn-conventions`) y cancelar no cambia nada; con la pantalla bloqueada 1–2 min durante un estudio, al volver el contador muestra el valor exacto (RF-10); `npx tsc --noEmit` en verde. La alternancia completa de fases al llegar a 00:00 se confirma con los escenarios en T10.

- [x] **T9. Etiqueta de fase y fila de puntos de avance en `app/index.tsx`, con accesibilidad y colores desde `src/theme/colors.ts`.** RF-8, RF-9, RNF-2
  - Hecho cuando: en Expo Go se ve la etiqueta «Estudio» encima del reloj (Azul Marino `#1B1D5D` sobre Blanco Nieve) y, debajo, la fila de 4 puntos —vacíos con borde de 2 px en Azul Marino al inicio—; pasan los puntos de lista «Se ve bien en vertical…» y «Los textos y el reloj se leen perfectamente…»; la etiqueta tiene `accessibilityRole="text"` con `accessibilityLabel="Fase actual: …"` y la fila `accessibilityLabel="Pomodoros completados: n de 4"`; todos los textos visibles en español; ningún color fuera de `src/theme/colors.ts` (los puntos rellenos y la etiqueta durante el descanso se confirman en T10).

- [x] **T10. Verificación final de la spec.** RF-1 a RF-11, RNF-1, RNF-2 — *Hecho: `npx jest` 64/64 y `npx tsc --noEmit` en verde (incluye `timer.test.ts` sin cambios); matriz del plan §7 cubierta por las 32 pruebas de `cycle.test.ts`; RNF-1 sin dependencias nuevas (24 deps / 9 devDeps, línea base intacta) y RNF-2 sin colores fuera de `src/theme/colors.ts`; los 4 escenarios de HU-002, RF-10 (bloqueo → descanso listo con su tiempo completo), descanso largo (etiqueta «Descanso largo», 4 puntos vacíos, controles activos) y RF-6/RF-7 (reiniciar descanso y estudio a mitad no cambia el contador) verificados por el usuario en Expo Go; puntos no aplicables de `rn-conventions` apuntados (teclado/ajustes: sin campos en esta historia; «Cerrar la app por completo… conserva el estado»: fuera de alcance, Decisión 6 → HU-003); `MEMORY.md` actualizado.*
  - Hecho cuando: `npx jest` y `npx tsc --noEmit` en verde (incluye `timer.test.ts` sin cambios); en Expo Go pasan los 4 escenarios de HU-002 (incluye bloquear la pantalla con el estudio corriendo → al volver, descanso listo con su tiempo completo, RF-10; durante el descanso largo: etiqueta «Descanso largo», 4 puntos vacíos y controles activos); reiniciar un descanso y un estudio a mitad no cambia el contador; RNF-1 sin dependencias nuevas; RNF-2 sin colores fuera de `src/theme/colors.ts`; puntos no aplicables de `rn-conventions` apuntados (teclado/ajustes: sin campos en esta historia; «Cerrar la app por completo… conserva el estado»: fuera de alcance, Decisión 6 → HU-003); `MEMORY.md` actualizado («Estado actual» y «Próximos pasos» → `/sdd-implement 002-descanso`).
