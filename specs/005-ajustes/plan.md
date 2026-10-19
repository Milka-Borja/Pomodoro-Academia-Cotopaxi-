# Plan — Spec 005: Ajustar los tiempos del pomodoro

Spec: `specs/005-ajustes/spec.md` (Estado: **aprobada**; dudas abiertas: ninguna).
Decisiones: `specs/005-ajustes/decisiones.md` (Decisión 1–9, todas cerradas; la 9
resuelve el restablecer como acción final que persiste y cierra).
Base: `docs/constitution.md`, `AGENTS.md`, skills `pomodoro-rules`, `cotopaxi-brand`
y `rn-conventions`.
Cobertura: RF-1 a RF-13, RNF-1 a RNF-4. Cada sección indica qué RF cubre.

---

## 1. Archivos que se crean o modifican

| Archivo | Acción | Responsabilidad | RF |
|---|---|---|---|
| `src/domain/settings.ts` | **Crea** | Lógica pura de ajustes: `PomodoroSettings`, `DEFAULT_SETTINGS` (25/5/15/4), `SETTINGS_RANGES` (1–60 / 1–30 / 1–60 / 1–10), `validateSettingsField` / `validateSettings` con mensajes en español que citan el rango, `formatRangeHint`, `settingsToConfig`. Sin React, sin AsyncStorage, sin `Date.now()`. | RF-1, RF-9, RF-10, RF-11, RF-12 |
| `src/domain/cycle.ts` | Modifica | Tipo `PomodoroConfig { durationsMs, pomodorosPerCycle }` con default actual (`DEFAULT_POMODORO_CONFIG`); parámetro **opcional** en las transiciones (compat con 001–004); función nueva `applySettingsToCycle` que solo toca la fase **idle**. Sigue puro, con `nowMs` inyectado. | RF-1, RF-7, RF-8, RF-9 |
| `src/storage/settingsCodec.ts` | **Crea** | Codec puro `serializeSettings` / `parseStoredSettings` validado (enteros dentro de rango; dato inválido → `null`), patrón de `sessionCodec.ts`. | RF-2 |
| `src/storage/cycleStorage.ts` | Modifica | `SETTINGS_KEY = '@pomodoro/settings'` con `loadSettings` (ausente/corrupto → `null`) y `saveSettings` (mejor esfuerzo, error tragado), junto a los flags existentes. | RF-2 |
| `app/settings.tsx` | **Crea** | Ruta `/settings`: cabecera con «Atrás», 4 campos con teclado numérico, rango visible siempre, errores bajo campo, pie fijo con «Restablecer» y «Guardar»; restablecer confirmado persiste y cierra (decisión 9). | RF-3, RF-4, RF-9, RF-10, RF-11, RF-12, RF-13 |
| `app/index.tsx` | Modifica | Engranaje en cabecera → `router.push('/settings')`; hidratación de ajustes al montar + recarga con `useFocusEffect`; acciones `APPLY_SETTINGS`, y `START_NEXT` / `CONFIRM_RESET` con el config vigente; puntos y label según `settings.pomodorosPerCycle`. | RF-1, RF-5, RF-6, RF-7, RF-8 |
| `src/domain/__tests__/settings.test.ts` | **Crea** | Rangos, validación, hints, `settingsToConfig`, sin mocks. | RF-9, RF-10, RF-11, RF-12 |
| `src/storage/__tests__/settingsCodec.test.ts` | **Crea** | Round-trip, JSON roto, fuera de rango → `null`. | RF-2 |
| `app/__tests__/settings.test.tsx` | **Crea** | Flujo de pantalla: validación, Guardar, descarte, restablecer. | RF-3, RF-4, RF-9, RF-10, RF-11, RF-12, RF-13 |
| `src/domain/__tests__/cycle.test.ts` | Modifica | Casos de `applySettingsToCycle` y transiciones con config propio; los de 001–004 intactos. | RF-1, RF-7, RF-8, RF-9 |
| `src/storage/__tests__/cycleStorage.test.ts` | Modifica | `loadSettings` / `saveSettings`. | RF-2 |
| `app/__tests__/index.test.tsx` | Modifica | Engranaje, repintado con ajustes cargados; mocks `expo-router` + `loadSettings`. | RF-1, RF-5, RF-7, RF-8 |
| `app/__tests__/index.realtime.test.tsx` | Modifica | Solo mocks; el reloj no cambia. | RF-6 |
| `app/_layout.tsx`, `src/domain/timer.ts`, `src/theme/colors.ts`, `package.json` | **No se modifican** | Ruta auto-registrada; timestamps absolutos intactos (principio 6); paleta única (principio 7); **cero dependencias nuevas** (principio 1). | RF-5, RNF-1, RNF-3, RNF-4 |
| `MEMORY.md` | Modifica | Solo «Estado actual»/«Próximos pasos» al terminar. | — |

## 2. Funciones puras de lógica (`src/domain/`)

```
// settings.ts (RF-9, RF-10, RF-11, RF-12)
SettingsField = 'studyMinutes'|'shortBreakMinutes'|'longBreakMinutes'|'pomodorosPerCycle'
DEFAULT_SETTINGS = {25, 5, 15, 4}   ·   SETTINGS_RANGES = {60, 30, 60, 10} con min 1

validateSettingsField(campo, texto): string | null
  vacío                → `Escribe un valor. Puedes usar ${rango}.`
  no /^\d+$/           → `Solo se admiten números enteros. Usa ${rango}.`  // decimales/negativos/letras
  fuera de min..max    → `Usa un valor entre ${min} y ${max}.`             // incluye 0
  // todos citan el rango → HU-005 Escenario 2 (RF-10)

validateSettings(raw) → mapa de errores por campo; {} si todo válido
  // la pantalla solo llama a saveSettings si queda vacío → todo o nada (RF-10)

formatRangeHint(campo) → «1–60 min», «1–30 min», «1–60 min», «1–10»        // RF-11

settingsToConfig(s) → { durationsMs: {study, shortBreak, longBreak en ms}, pomodorosPerCycle }
  // valores por defecto derivados de las constantes existentes: una única fuente de verdad (RF-1, RF-8, RF-9)

// cycle.ts (RF-1, RF-7, RF-8, RF-9)
PomodoroConfig = { durationsMs: Record<Phase, number>, pomodorosPerCycle: number }
DEFAULT_POMODORO_CONFIG = constantes actuales
createInitialCycleState(config?) · advanceToNextPhase(state, config?) ·
startNextPhase(state, nowMs, config?) · confirmResetCycle(state, config?) ·
getPomodorosCompletados(completed, pomodorosPerCycle?)     // sin argumento = hoy → 001–004 en verde

applySettingsToCycle(state, config): CycleState            // NUEVA, RF-7
  si status != 'idle'        → state                       // fase iniciada intocable
  si nuevaDur == durationMs  → state                       // identidad
  → { ...state, timer: { ...state.timer, durationMs: nuevaDur } }
  // completedPomodoros NUNCA se toca (RF-8, RF-9)

// RF-8: advanceToNextPhase / startNextPhase comparan
// completedPomodoros >= config.pomodorosPerCycle con el config VIGENTE en la transición:
//   contador ≥ valor nuevo → descanso largo (cero atómico); si no → descanso corto y sigue contando.
// detectPhaseEndWhileAway no cambia (solo suma).
```

## 3. Persistencia (`src/storage/`)

- Clave nueva `@pomodoro/settings` (JSON de `PomodoroSettings`); `loadSettings` →
  `null` si no hay dato o el codec lo rechaza; `saveSettings` traga errores como
  `saveCycleState`. *(RF-2)*
- `@pomodoro/session` **no cambia de formato** (AGENTS.md: no tocar formatos
  guardados). *(RF-2, RNF-2)*
- La persistencia de sesión existente guarda el `durationMs` de la fase idle
  actualizada (sus deps ya lo incluyen): sesión y ajustes quedan consistentes.
  *(RF-1, RF-2)*

## 4. Algoritmo en pseudocódigo

**Ajustes (`app/settings.tsx`)** — RF-3, RF-4, RF-9, RF-10:

```
form: Record<SettingsField,string> · errors · formHydrated (Guardar/Restablecer deshabilitados hasta cargar)

al montar: s = (await loadSettings()) ?? DEFAULT_SETTINGS → form; formHydrated = true

handleChange(campo, texto): si !/^[0-9]*$/ → retornar            // RF-12
                            form[campo] = texto; errors[campo] = undefined   // el error se limpia al corregir

handleGuardar: errors = validateSettings(form)
               si errors ≠ {} → setErrors; retornar             // RF-10: nada se guarda, SIN diálogo
               await saveSettings(aSettings(form))              // RF-2
               router.back()                                    // RF-3: sin mensaje

handleRestablecer: Alert.alert('¿Restablecer los ajustes?',
                    'Los tiempos volverán a 25, 5 y 15 minutos, y 4 pomodoros por ciclo.',
                    [ Cancelar,
                      Restablecer: async () => { await saveSettings(DEFAULT_SETTINGS);
                                                 router.back() } ])   // RF-9 + decisión 9: cierra SIN Guardar

handleAtrás: router.back()                                      // RF-4: no escribe nada
             // «Atrás» y el volver nativo de Android comparten este camino:
             // ninguna ruta escribe en storage sin Guardar o Restablecer.
```

**Principal (`app/index.tsx`)** — RF-1, RF-5, RF-7, RF-8:

```
settings (useState) · config = settingsToConfig(settings)

al montar: [stored, storedSettings] = await Promise.all([loadCycleState(), loadSettings()])
           LOAD(si hay sesión) → setSettings → dispatch APPLY_SETTINGS   // tras el LOAD
           setHydrated(true)

useFocusEffect: s = (await loadSettings()) ?? DEFAULT → setSettings (con igualdad)
                dispatch APPLY_SETTINGS(config)                // sin cambios → identidad (RF-4)

engranaje: onPress → router.push('/settings')                  // RF-5

reducer: APPLY_SETTINGS → applySettingsToCycle(state, config)  // RF-7
         START_NEXT     → startNextPhase(state, now, config)   // RF-1, RF-8
         CONFIRM_RESET  → confirmResetCycle(state, config)     // RF-1 (pomodoro-rules)

puntos: getPomodorosCompletados(completed, settings.pomodorosPerCycle) · label «de N»
// RF-6: navegar no despacha nada sobre el temporizador; intervalo y timestamps siguen con index montado
```

## 5. Cómo se pinta en la interfaz

- **Cabecera principal** *(RF-5)*: engranaje como `Text` glifo `⚙︎` (U+2699+FE0E)
  en `colors.navyBlue`, ≥44 px con `hitSlop`, `accessibilityRole="button"` y
  `accessibilityLabel="Ajustes"` (rn-conventions).
- **`/settings`** *(RF-3, RF-4, RF-9 a RF-13)*: `SafeAreaView` → cabecera «←»
  (`accessibilityLabel="Atrás"`) + «Ajustes» → `KeyboardAvoidingView`
  (`behavior="padding"` en iOS; Android en resize) con `ScrollView` de campos y
  **pie fijo fuera del scroll** con «Restablecer» (dorado, texto Azul Marino) y
  «Guardar» (Azul Marino, texto Blanco Nieve): el teclado no tapa el Guardar *(RF-13)*.
- **Cada campo** *(RF-11, RF-12)*: `TextInput` `keyboardType="numeric"` con
  filtro de dígitos, etiqueta en español y debajo SIEMPRE el rango (Azul Marino
  con opacidad ≤ 0.7, variación permitida de la paleta; AA verificado).
- **Error** *(RF-10, RNF-3)*: bajo el campo, `navyBlue` semibold y borde Azul
  Marino — sin rojos/verdes puros (prohibidos en `cotopaxi-brand`), sin `Alert`.
- **Restablecer** *(RF-9)*: `Alert.alert` nativo (rn-conventions: acción crítica).
- **Fin de fase estando en ajustes** *(RF-6)*: sin código propio: el intervalo de
  `index` sigue vivo y la alarma/aviso de 004 ocurre igual.
- **Sin conexión** *(RNF-1)*: Expo Router + AsyncStorage locales; cero red nueva.

## 6. Decisiones técnicas justificadas

1. **Config como parámetro opcional en `cycle.ts`.** No toca el formato de la
   sesión ni las firmas de 001–004 (principios 3 y 4: 181 pruebas en verde).
   *Descartado:* meter `settings` en `CycleState` (cambiaría `@pomodoro/session` —
   AGENTS.md obliga a preguntar; mezcla sesión y configuración).
2. **Clave propia `@pomodoro/settings` + codec validado.** No altera datos
   existentes; carga independiente. *Descartado:* campos en el JSON de la sesión
   (mismo motivo) y 4 claves sueltas (fallos parciales de un JSON validado de una vez).
3. **Ruta `/settings` + `useFocusEffect` con dispatch `APPLY_SETTINGS`.**
   Mantiene `index` vivo detrás (RF-6) y reaplica al volver sin acoplar pantallas.
   *Descartado:* callbacks por params (no los soporta router), estado
   global/contexto (dependencia o boilerplate), releer solo al montar (no
   aplicaría nada al volver).
4. **Solo la fase `idle` recibe la duración nueva.** Las iniciadas viven de
   `endTimestampMs` absoluto. *Descartado:* recalcular remanentes (rompe RF-7 y
   el principio 6 — decisión 6).
5. **Rangos/validación/mensajes en dominio puro.** Escenario 2 testeable con
   Jest sin render (principios 3 y 4). *Descartado:* validar solo en el
   componente (los criterios de la spec exigen prueba de lógica en verde).
6. **Engranaje como glifo de texto monócromo, sin librería.** *Descartado:*
   `@expo/vector-icons` (no instalado; dependencia nueva → principio 1/AGENTS.md)
   y dibujarlo con `View`s (código desproporcionado). Plan B: si alguna
   plataforma lo pinta a color, se dibuja con Views (quedaría registrado en tasks).
7. **Solo Guardar y Restablecer escriben ajustes.** *Descartado:* persistir al
   detectar cambios (guardaría lo no confirmado, contrario a RF-4).
8. **Hidratación espera sesión Y ajustes; focus reaplica con identidad.**
   Ningún «Iniciar siguiente»/«Reiniciar» dispara con config por defecto.
   *Descartado:* `useRef` sin estado (los puntos y el label los pintan desde el render).

## 7. Estrategia de pruebas con Jest

Nuevos: `settings.test.ts`, `settingsCodec.test.ts`, `settings.test.tsx`.
Extendidos: `cycle.test.ts`, `cycleStorage.test.ts`, `index.test.tsx`. Mocks:
`index.realtime` solo gana `expo-router` + `loadSettings`. Reloj fijo `t0`.
Matriz (caso → RF):

| Caso | RF |
|---|---|
| `validateSettingsField`: vacío / `'0'` / `'-5'` / `'30.5'` / fuera de rango → error **con el rango en el mensaje**; límites mismos (`'60'`,`'30'`,`'10'`) → `null` | RF-10, RF-12 |
| `validateSettings` con 1 campo mal → error solo ahí y `saveSettings` no llamado (todo o nada) | RF-10 |
| `formatRangeHint` → «1–60 min», «1–30 min», «1–60 min», «1–10»; `DEFAULT_SETTINGS` = 25/5/15/4 | RF-11, RF-9 |
| `applySettingsToCycle`: idle → duración nueva; running → `endTimestampMs` intacto; paused → `pausedRemainingMs` intacto; contador intacto; mismo valor → identidad | RF-7, RF-9 |
| Transiciones con config propio: `{pomodorosPerCycle:2}` → 2.º estudio → largo con cero atómico; contador 3 vs valor 2 → largo; contador 1 vs valor 3 → corto (sigue contando) | RF-8 |
| Duraciones propias en siguiente fase y en `confirmResetCycle` (contador sin tocar) | RF-1, RF-9 |
| Sin argumento, `cycle.ts` idéntico a hoy (regresión 001–004) | RF-6 |
| `settingsCodec`: round-trip / roto / fuera de rango → `null`; `cycleStorage`: clave exacta, ausente → `null`, error tragado | RF-2 |
| `settings.tsx`: hints visibles, `keyboardType="numeric"`, filtro de letras | RF-11, RF-12 |
| `settings.tsx`: Guardar inválido → error bajo campo y ni `saveSettings` ni `back`, sin `Alert` | RF-10 |
| `settings.tsx`: Guardar válido → guarda y `back` sin mensaje; «Atrás» → `back` sin guardar | RF-3, RF-4 |
| `settings.tsx`: «Restablecer» → `Alert` y al confirmar `saveSettings(DEFAULT)` + `back` sin pulsar Guardar; al cancelar → nada | RF-9, decisión 9 |
| `settings.tsx`: «Guardar» estructuralmente en el pie fuera del scroll (verificación real del teclado: manual) | RF-13 |
| `index`: engranaje → `router.push('/settings')`; `loadSettings` con 40 min/2 pomodoros → «40:00» y «de 2» | RF-5, RF-1, RF-7, RF-8 |
| `index`: reducer con `APPLY_SETTINGS` / `START_NEXT` / `CONFIRM_RESET` recibe el config vigente | RF-1, RF-7, RF-8 |
| `index.realtime`: mocks actualizados; el reloj sigue bajando tras «Iniciar» (regresión T7) | RF-6 |
| `timer.test.ts` sin cambios + casos existentes intactos | RNF-4 |

> **Notas de mocks:** `index.tsx` pasa a importar `expo-router` y `loadSettings`,
> así que ambos `index*.test.tsx` necesitan `jest.mock('expo-router', …)`
> (`router.push/back` y `useFocusEffect`) y el factory de `cycleStorage` gana
> `loadSettings` (y `SETTINGS_KEY`). `settings.test.tsx` mockea igual.

**Manual Expo Go (los 4 escenarios de HU-005):** cambiar a 40 → Guardar cierra
sin mensaje, próxima fase 40:00 y persiste al cerrar; vacío/0/70 → error bajo
campo con rango, nada se guarda; restablecer → se cierra solo con 25/5/15/4 y
contador intacto; con estudio corriendo cambiar duración → el reloj no salta y
el cambio llega a la siguiente. Además: contador 3→2 da largo al terminar el
estudio, teclado no tapa Guardar, salir sin guardar descarta, engranaje abre,
reloj sigue bajando en ajustes, contraste `cotopaxi-brand` (incluidos errores) y
lista de `rn-conventions`.

**Cierre:** `npx jest` y `npx tsc --noEmit` en verde.

## 8. Fuera de alcance (no se toca aquí)

- Sonidos, avisos y apariencia (los otros ajustes que la HU excluye).
- Pausar, reiniciar o saltar de fase desde ajustes (decisión 3).
- Editar los valores por defecto de la técnica (decisión 5).
- Cuentas, sincronización o respaldos (constitución 5).
- Estadísticas o historial de sesiones.
- Duplicar la lógica de rangos en la UI: los mensajes salen del dominio (§2).
- Modificar `timer.ts`, la paleta o el formato de `@pomodoro/session`.
