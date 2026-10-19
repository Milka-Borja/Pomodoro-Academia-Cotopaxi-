# Tareas — Spec 006: Usar la aplicación sin registro, sin internet y sin publicidad

Plan: `specs/006-offline/plan.md`. Spec: `specs/006-offline/spec.md` (aprobada).
Puerta constitucional 4: `npx jest` y `npx tsc --noEmit` en verde al cerrar cada
tarea que toque código o pruebas.

- [x] **T1. Guardia de red global en Jest.** RF-7, RF-4
  - Qué: crear `jest.setup.js` en la raíz que reemplaza `global.fetch`,
    `global.XMLHttpRequest` y `global.WebSocket` por stubs que lanzan
    «Violación offline (spec 006, RF-7): petición de red vía <api>»; añadir
    `"setupFilesAfterEnv": ["<rootDir>/jest.setup.js"]` al bloque `jest` de
    `package.json` (sin tocar `dependencies`). No se redefine `setupFiles`
    (decisión técnica 2: pisaría el setup de jest-expo).
  - Hecho cuando: `npx jest --showConfig` muestra `setupFilesAfterEnv` apuntando
    a `jest.setup.js` Y el `setupFiles` del preset intacto; `npx jest` queda en
    verde (las 251 pruebas existentes corren con la red bloqueada sin ninguna
    activación de la guardia).
  - **HECHA (2026-10-19).** Evidencia:
    - `--showConfig`: `setupFiles` = [RN preset setup, jest-expo setup] intacto;
      `setupFilesAfterEnv` = [`jest.setup.js`]. ✔
    - `npx jest`: 11 suites / 251 pruebas en verde con la guardia activa
      (3 ejecuciones completas consecutivas + `index.test.tsx` en solitario).
    - `npx tsc --noEmit`: sin errores. ✔
    - Incidencia de la 1.ª ejecución completa: 2 fallos transitorios en
      `app/__tests__/index.test.tsx` (prueba sensible a tiempo del flujo de
      permisos, 813 ms en solitario) bajo carga paralela — NO activaron la
      guardia (cero «Violación offline» en cualquier ejecución) y no se
      reprodujeron en 4 corridas posteriores: flake de entorno, no regresión.
    - Sin cambios de interfaz: no aplica lista manual.
  - RF cubiertos: **RF-7** (guardia instalada: cualquier `fetch`/XHR/`WebSocket`
    futuro revienta cualquier suite) y **RF-4** (las 251 pruebas existentes
    ejercitan temporizador, avisos, ajustes, storage y permisos sin un solo
    intento de red). Escenarios de HU-006: el Escenario 2 queda respaldado por
    pruebas automatizadas, pero su verificación manual en modo avión sigue
    pendiente hasta T5.

- [x] **T2. Autotest de la guardia de red.** RF-7
  - Qué: crear `__tests__/offline.test.ts` (raíz) con el caso «las tres APIs de
    red lanzan al usarse»: `fetch()`, `new XMLHttpRequest()` y `new WebSocket()`
    deben lanzar el error de la guardia.
  - Hecho cuando: `npx jest` en verde con la prueba presente; y verificado el
    fallo por mutación — quitando temporalmente `setupFilesAfterEnv` de
    `package.json` la prueba queda en rojo y, al restaurarlo, vuelve a verde.
  - **HECHA (2026-10-19).** Evidencia:
    - Rojo por mutación: sin `setupFilesAfterEnv`, las 3 pruebas fallan
      («Received function did not throw», 3 failed / 3 total). ✔
    - Verde tras restaurar: suite de `__tests__/offline.test.ts` → 3/3. ✔
    - Puerta completa: `npx jest` → **12 suites / 254 pruebas en verde**
      (251 previas + 3 nuevas); `npx tsc --noEmit` sin errores. ✔
    - Sin cambios de interfaz: no aplica lista manual.
  - RF cubierto: **RF-7** — si alguien borra o rompe la guardia de T1, estas
    pruebas revientan y lo delatan. Escenarios de HU-006: refuerza el
    Escenario 2 (sin conexión) ya respaldado por T1; verificación manual
    pendiente hasta T5.

- [x] **T3. Pruebas de dependencias prohibidas y escáner de URLs.** RF-10, RF-11
  - Qué: ampliar `__tests__/offline.test.ts` con dos casos: (a) «ningún SDK de
    anuncios, analítica, crash reporting ni telemetría» —lee `package.json` y
    falla ante patrones prohibidos (sentry, amplitude, mixpanel, crashlytics,
    firebase, admob, bugsnag, telemetry…)—; (b) «cero URLs remotas en el código
    y la configuración» —lee `app/**`, `src/**`, `app.json` y `metro.config.js`
    y falla ante cualquier `http(s)://`—.
  - Hecho cuando: `npx jest` en verde con ambas pruebas (hoy pasan: deps limpias
    y cero URLs, verificado); y verificado el fallo por mutación — añadir
    temporalmente `@sentry/react-native` a `dependencies` y una URL `https://`
    de prueba en un `.ts` de `src/` deja ambas pruebas en rojo; al revertir,
    verde.
  - **HECHA (2026-10-19).** Evidencia:
    - Rojo por mutación simultánea: `@sentry/react-native` en `dependencies` +
      `src/tmp-probe-t3.ts` con una URL → **2 failed / 5** — RF-10 señaló
      «@sentry/react-native» y RF-11 señaló «src\tmp-probe-t3.ts». ✔
    - Mutaciones revertidas (dependencia quitada, probe borrado):
      `__tests__/offline.test.ts` → 5/5. ✔
    - Puerta completa: `npx jest` → **12 suites / 256 pruebas en verde**;
      `npx tsc --noEmit` sin errores. ✔
    - Sin cambios de interfaz: no aplica lista manual.
  - RF cubiertos: **RF-10** (cero SDKs de anuncios/analítica/crash/telemetría
    en las dependencias que se empaquetan; `devDependencies` quedan fuera a
    propósito: son herramientas de build/prueba que no viajan en el bundle) y
    **RF-11** (ninguna URL `http(s)://` en `app/`, `src/`, `app.json` ni
    `metro.config.js`). Escenarios de HU-006: automatizan la garantía del
    Escenario 3; su recorrido manual de pantallas queda pendiente en T5.

- [x] **T4. Prueba de arranque: primer arranque vacío y datos corruptos.** RF-1, RF-2, RF-9
  - Qué: crear `app/__tests__/boot.test.tsx` con `cycleStorage` REAL y el mock
    oficial de AsyncStorage (mocks de `notifications` y `expo-router` igual que
    en `app/__tests__/index.test.tsx`, por convención): caso 1 — almacenamiento
    vacío → se pinta el temporizador con la fase de estudio por defecto, sin
    ningún texto de cuenta/registro/login; caso 2 — basura sembrada en las 6
    claves (`'{ corrupto'`, `'25'`, `'[1,2]'`) → se aplican los defaults
    25/5/15/4, `Alert.alert` nunca se invoca y nada bloquea el uso.
  - Hecho cuando: `npx jest` en verde; la suite falla si se rompe el fallback
    `?? DEFAULT_SETTINGS` de `app/index.tsx` (verificado por mutación: cambiar
    temporalmente el fallback por `storedSettings` deja el caso 2 en rojo).
  - **HECHA (2026-10-19).** Evidencia:
    - Verde con código actual: `boot.test.tsx` → 2/2 (ambos casos: defaults
      pintados, cero diálogos, sin textos de cuenta; en el caso 2 además el
      «Iniciar» arranca el reloj → 24:59, probando que nada queda bloqueado). ✔
    - Rojo por mutación: fallback de `app/index.tsx` cambiado a `storedSettings`
      → **2 failed / 2** (la app revienta al hidratar); revertido y verificado
      por contenido (línea 206 intacta, única coincidencia). ✔
    - Puerta completa: `npx jest` → **13 suites / 258 pruebas en verde**;
      `npx tsc --noEmit` sin errores. ✔
    - Sin cambios de interfaz (solo pruebas): no aplica lista manual.
  - RF cubiertos: **RF-1** (almacén vacío → directo al temporizador con
    defaults, sin pantalla de cuenta: HU-006 Escenario 1 automatizado),
    **RF-2** (ningún texto de cuenta/registro/login en el árbol) y **RF-9**
    (basura en las 6 claves → descarte silencioso, defaults 25/5/15/4, cero
    `Alert` y uso no bloqueado; HU-006 Escenario 2 en su vertiente de datos).
    La verificación manual en modo avión sigue pendiente hasta T5.

- [x] **T5. Lista manual en modo avión, revisión documentada y cierre.** RF-2, RF-3, RF-5, RF-6, RF-8 (verificación final de todos los RF)
  - Qué: en Expo Go con el dispositivo en modo avión (tras cargar el bundle con
    Metro — salvedad del bundle de desarrollo, decisión 4, documentada):
    recorrer los 3 escenarios de HU-006 y la lista manual de `rn-conventions`,
    y dejar escrita la evidencia en esta tarea:
    - Escenario 1 (RF-1, RF-2, RF-3): primera apertura → directo al
      temporizador; el «Iniciar» del primer arranque muestra los modales de
      permisos de la spec 004 y todas sus rutas terminan arrancando el reloj.
    - Escenario 2 (RF-4, RF-5, RF-8): temporizador, avisos y ajustes funcionan
      en modo avión; **punto de la lista rn-conventions**: «Cerrar la app por
      completo y abrirla conserva los tiempos personalizados y el estado de la
      sesión»; ningún indicador de «sin conexión» en pantalla (RF-8).
    - Escenario 3 (RF-10, RF-11): recorrido de pantallas sin anuncios; revisión
      de `package.json` (cero SDKs de anuncios/analítica/crash/telemetría) y de
      activos (todo empaquetado localmente) dejada por escrito.
    - **Puntos de rn-conventions** (UI intacta): «Se ve bien en vertical y los
      elementos no se desbordan» y «Los textos y el reloj se leen
      perfectamente, respetando los contrastes de la skill cotopaxi-brand»;
      los diálogos `Alert.alert` solo aparecen en acciones críticas (RF-9: los
      datos corruptos NO abren ningún diálogo).
    - RF-6: nota documentada — desinstalar borra todo; una reinstalación arranca
      con defaults (decisión 3; sin copias ni exportar).
  - Hecho cuando: los tres escenarios y los puntos citados están recorridos y
    anotados con su resultado; `npx jest` y `npx tsc --noEmit` en verde;
    `spec.md` pasa a estado «completada» y `MEMORY.md` queda actualizado.
  - **HECHA (2026-10-19).** Evidencia:
    - Lista manual recorrida en Expo Go con el dispositivo en modo avión por
      el usuario: **confirmación global «todo bien»** — los 3 escenarios de
      HU-006 (1.1–1.3, 2.1–2.5, 3.1–3.2), los 4 puntos de `rn-conventions`
      (4.1–4.4) y la nota de desinstalación RF-6 (5.1, punto opcional) quedan
      verificados; salvedad del bundle de desarrollo (decisión 4) documentada.
    - Puertas automáticas al cierre: `npx jest` → **13 suites / 258 pruebas en
      verde**; `npx tsc --noEmit` sin errores. ✔
    - Cero dependencias nuevas y cero cambios en código de producción en toda
      la spec (solo `jest.setup.js`, la clave `setupFilesAfterEnv` y pruebas).
  - RF cubiertas por escenario (automático + manual): **Escenario 1** → RF-1,
    RF-2, RF-3 ✔; **Escenario 2** → RF-4, RF-5, RF-8, RNF-1 ✔; **Escenario 3**
    → RF-10, RF-11 ✔; **RF-6** ✔ (pérdida al desinstalar, confirmada);
    **RF-7** (automático, T1/T2) y **RF-9** (automático, T4) cerrados desde
    sus tareas. RNF-1 a RNF-4 cubiertos (modo avión, cero SDKs externos, datos
    solo locales y sin URLs remotas). Spec 006 → **completada**.
