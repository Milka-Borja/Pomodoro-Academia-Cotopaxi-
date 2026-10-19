# Plan — Spec 006: Usar la aplicación sin registro, sin internet y sin publicidad

Spec: `specs/006-offline/spec.md` (aprobada). Decisiones: `specs/006-offline/decisiones.md` (8).
Respeto: constitución (todos los principios), AGENTS.md y las skills `pomodoro-rules`,
`cotopaxi-brand` y `rn-conventions`.

## Resumen del enfoque

Las specs 001–005 ya construyen el comportamiento que HU-006 promete (primer arranque
directo al temporizador, avisos sin bloqueo, ajustes persistidos en local, fallback a
defaults). **Esta spec no añade una funcionalidad nueva: añade garantías comprobables**
de que esa promesa no se rompa mañana. Por eso el alcance es sobre todo de **verificación**:

1. Una **guardia de red global en Jest**: toda la suite (las 251 pruebas actuales y las
   nuevas) corre con `fetch`/XHR/`WebSocket` bloqueados; cualquier petición futura revienta
   las pruebas (RF-7, RF-4).
2. **Pruebas de garantía** de los rezagos que hoy solo cubre la revisión manual:
   arranque con datos corruptos (RF-9), SDKs prohibidos en dependencias (RF-10) y URLs
   remotas en el código/ configuración (RF-11).
3. **Cero cambios en código de producción**: no se toca `src/domain`, `src/storage`,
   `src/notifications`, `src/components` ni `app/` (salvo nada: ver «Funciones puras»).
4. Una **lista manual** documentada en `tasks.md` para lo que Jest no puede probar
   (modo avión real, revisión de pantallas, desinstalación).

Cero dependencias nuevas (RNF-2, constitución 1). Solo se añade configuración de Jest.

## Archivos que se crean o modifican

| Archivo | Acción | Responsabilidad | RF |
|---|---|---|---|
| `jest.setup.js` (raíz) | **Crea** | Guardia de red: reemplaza `global.fetch`, `global.XMLHttpRequest` y `global.WebSocket` por stubs que lanzan un error con mensaje claro («Violación offline (spec 006, RF-7): la app no debe hacer peticiones de red»). Se instala en TODAS las suites. | RF-7, RF-4 |
| `package.json` | **Modifica** | Añade `"setupFilesAfterEnv": ["<rootDir>/jest.setup.js"`] dentro del bloque `jest`. Sin tocar `dependencies` (cero dependencias nuevas). | RF-7 |
| `__tests__/offline.test.ts` (raíz, junto a `package.json` que es lo que custodia) | **Crea** | Tres garantías estáticas: (a) autotest de la guardia —llamar `fetch`/`XHR`/`WebSocket` lanza—; (b) `package.json` no contiene SDKs de anuncios, analítica, crash reporting ni telemetría (patrones prohibidos); (c) ningún archivo de `app/`, `src/`, `app.json` ni `metro.config.js` contiene `http(s)://` (activos y código sin URLs remotas). | RF-7, RF-10, RF-11 |
| `app/__tests__/boot.test.tsx` | **Crea** | Arranque con `cycleStorage` REAL (solo se mockea AsyncStorage con el mock oficial): (1) almacenamiento vacío → pantalla de temporizador directa, sin pantalla de cuenta; (2) datos corruptos en sesión/ajustes/flags → arranca con los defaults 25/5/15/4, sin `Alert` y sin bloqueo. | RF-1, RF-9 (RF-2, RF-3 por regresión) |
| `specs/006-offline/tasks.md` | **Crea** (fase `/sdd-tasks`) | Tareas + **lista manual** documentada: recorrido en modo avión de las 3 pantallas, revisión de `package.json` y de activos, nota de desinstalación y salvedad del bundle de desarrollo (decisión 4). | RF-2, RF-5, RF-6, RF-8 + verificación final de todos |

Archivos que **NO** se tocan y por qué: `src/domain/*`, `src/storage/*`,
`src/notifications/*`, `src/components/*`, `app/index.tsx`, `app/settings.tsx`,
`app/_layout.tsx`, `app.json` (permisos), `metro.config.js` (parche de 003): la spec no
pide comportamiento nuevo y la constitución prohíbe implementar lo que no está en la spec.

## Funciones puras de lógica (`src/domain`)

**No se crean funciones puras nuevas.** La lógica pura que garantiza los RF de esta spec
ya existe, está probada y no cambia:

- `parseStoredSettings` / `parseStoredCycleState` (`src/storage/settingsCodec.ts`,
  `sessionCodec.ts`): validación estricta que devuelve `null` ante cualquier basura →
  base del fallback de **RF-9** (pruebas ya existentes en `settingsCodec.test.ts` y
  `sessionCodec.test.ts`).
- `DEFAULT_SETTINGS` (`src/domain/settings.ts`): los valores por defecto 25/5/15/4 que
  **RF-9** exige aplicar al descartar lo ilegible (fuente única: constantes de
  `src/domain/cycle.ts` y `timer.ts`, según la skill `pomodoro-rules`).
- `resolveNotificationPermissionAction` / `resolveExactAlarmInvitationAction`
  (`src/domain/permission.ts`): todas sus ramas terminan arrancando el reloj → base de
  **RF-3** (spec 004, ya probadas en `permission.test.ts`).

Añadir una «regla» nueva aquí sería inventar requisitos fuera de la spec
(constitución 2). La única lógica nueva es la guardia de red de `jest.setup.js`, que es
infraestructura de prueba, no lógica de negocio, y vive en la raíz a propósito.

## Persistencia

**Sin cambios en el formato ni en las claves guardadas** (AGENTS.md: no se cambia el
formato sin preguntar; la spec no lo pide). Las seis claves existentes de
`src/storage/cycleStorage.ts` (`@pomodoro/session`, `@pomodoro/settings` y los cuatro
flags de permisos) siguen igual. Lo que esta spec garantiza sobre lo ya persistido:

- **RF-5**: los ajustes siguen guardándose con `saveSettings` (mejor esfuerzo, sin
  romper la app si falla el disco) — comprobación: pruebas existentes de
  `cycleStorage.test.ts` + lista manual (cambiar un ajuste, cerrar, reabrir).
- **RF-9**: cualquier lectura fallida o dato ininteligible ya cae a `null`
  (try/catch en `loadSettings`/`loadCycleState` + validación de los codecs; pruebas
  existentes de fallo de disco y JSON corrupto). La **nueva** prueba de arranque
  (`boot.test.tsx`) endosa el camino completo hasta la pantalla.
- **RF-6**: AsyncStorage se borra al desinstalar; no se añade exportar/importar ni copia
  alguna (decisión 3; constitución 5). Sin código: queda en la lista manual y en la
  documentación de la spec.
- Sin versionado ni migraciones (decisión 8): cualquier dato de una versión futura
  ininteligible ya cae por el mismo camino de RF-9.

## Algoritmo en pseudocódigo

### 1. Guardia de red global (RF-7, RF-4) — `jest.setup.js`

```
EJECUTAR al cargar cada suite (después del setup de jest-expo):

  prohibir(api):
    LANZAR Error("Violación offline (spec 006, RF-7): petición de red vía " + api)

  global.fetch        ← () => prohibir("fetch")
  global.XMLHttpRequest ← clase cuyo constructor() llama prohibir("XHR")
  global.WebSocket    ← clase cuyo constructor() llama prohibir("WebSocket")
```

No hay lista blanca: ninguna ruta legítima de la app habla por red (RF-7 es absoluto),
así que cualquier activación es un fallo real.

### 2. Arranque resiliente (RF-9, RF-1) — camino existente que la nueva prueba endosa

```
AL MONTAR IndexScreen:
  (rawSession, rawSettings) ← Promise.all(loadCycleState(), loadSettings())

  loadSettings():
    raw ← AsyncStorage.getItem(SETTINGS_KEY)     // si LANZA → null
    s   ← parseStoredSettings(raw)               // basura/JSON roto/out-of-range → null
    devolver s                                    // nunca lanza

  settings ← rawSettings ?? DEFAULT_SETTINGS     // 25/5/15/4 (RF-9)
  SI rawSession ≠ null:
    dispatch LOAD(detectPhaseEndWhileAway(rawSession, ahora))
  dispatch APPLY_SETTINGS(settingsToConfig(settings))
  hydrated ← true
  // Sin Alert, sin pantalla de error, sin bloqueo (RF-9); el primer render ya es
  // el temporizador (RF-1). Los flags ilegibles se leen como "no mostrados aún"
  // (getItem ≠ null sobre basura) o caen a false por catch: nunca bloquean (RF-9).
```

### 3. Prueba de arranque corrupto (RF-9, RF-1) — `boot.test.tsx`

```
POR CADA caso en [almacén vacío, basura en las 6 claves]:
  AsyncStorage.clear(); sembrar claves con '{ corrupto', '25', '[1,2]'
  render(<IndexScreen />)   // cycleStorage REAL; notifications y expo-router mockeados
  ESPERAR hidratación
  VERIFICAR: en pantalla el temporizador con la fase de estudio a 25:00 (default)
  VERIFICAR: Alert.alert NUNCA llamado (sin diálogo, RF-9)
  VERIFICAR: ningún texto de cuenta/registro/login en pantalla (RF-1, RF-2)
```

## Cómo se pinta en la interfaz

**No se añade ni se cambia ningún elemento visual** — esa es, literalmente, la exigencia
de RF-8 (ningún indicador de «sin conexión») y de RNF-4 (nada visible depende de la red):

- `app/index.tsx`, `app/settings.tsx` y los modales de permisos de la spec 004 quedan
  idénticos. Cualquier diferencia visible sería un incumplimiento, no una mejora.
- Los colores siguen siendo los de `src/theme/colors.ts` (skill `cotopaxi-brand`); la
  única «pantalla» que RF-9 podría haber añadido (un diálogo de error de almacenamiento)
  queda **prohibida** — rn-conventions reserva los diálogos para acciones del usuario,
  no para fallos internos (decisión 7).
- La verificación es la **lista manual** en Expo Go con modo avión (temporizador, avisos
  y ajustes se ven y se comportan idénticos con y sin red) y la ausencia de cualquier
  texto tipo «sin conexión»/«offline»/«sin red» (se comprueba recorriendo las pantallas).

## Decisiones técnicas justificadas (con alternativa descartada)

1. **Guardia de red global vía `setupFilesAfterEnv`** (elegida) — bloquea `fetch`/XHR/
   `WebSocket` en las ~11 suites actuales y todas las futuras: el RF-7 queda protegido
   sin que nadie tenga que acordarse de nada. *Descartada: guardia solo en la suite
   nueva* — las 251 pruebas existentes seguirían sin red, pero sin garantizarlo, y una
   ruta futura de `app/` o `src/` pasaría sin avisar. *Descartada: solo revisión manual*
   — no protege de regresiones (decisión 1: la red de seguridad debe ser automática).
2. **`setupFilesAfterEnv`, no redefinir `setupFiles`** (elegida) — verificado en
   `node_modules/jest-expo/jest-preset.js` (L121–125): el preset empuja su propio
   `setup.js` dentro de `setupFiles`; si el proyecto definiera esa clave en `package.json`,
   **pisaría** el setup de jest-expo y rompería las suites. `setupFilesAfterEnv` no la
   define el preset, así que se añade sin pisar nada. *Descartada: `jest.config.js` con
   el preset expandido a mano* — duplica configuración ajena y crea un punto de fallo
   cuando jest-expo cambie.
3. **Patrones prohibidos en vez de lista blanca de dependencias** para RF-10 (elegida) —
   el test falla solo si aparece un SDK con nombre de anuncios/analítica/crash/telemetría
   (sentry, amplitude, mixpanel, crashlytics, firebase, admob, bugsnag…). *Descartada:
   lista blanca de las dependencias actuales* — obligaría a tocar el test en cada
   dependencia legítima futura, ensuciando la señal sin añadir garantía: el RF-10 prohíbe
   categorías, no exige inventario cerrado.
4. **Escáner de URLs automatizado + revisión manual** (elegida) — un test lee `app/`,
   `src/`, `app.json` y `metro.config.js` y falla ante cualquier `http(s)://` (RF-11);
   la revisión manual de activos documenta lo que el escáner no ve (imágenes binarias
   empaquetadas). *Descartada: solo revisión manual* — un `expo-image source={{uri}}`
   futuro pasaría inadvertido; el escáner cuesta 20 líneas y lo cubre.
5. **Prueba de arranque con `cycleStorage` REAL + mock oficial de AsyncStorage**
   (elegida) — la convención de `index.test.tsx` mockea `cycleStorage` entero, pero aquí
   se precisa justo lo contrario: ejercitar el path real `getItem → codec → null →
   DEFAULT_SETTINGS` hasta la pantalla. *Descartada: mockear `cycleStorage` como en las
   suites vecinas* — probaría el mock, no el descarte silencioso que RF-9 exige.
6. **Cero código de producción nuevo** (elegida) — la app ya cumple los RF porque 001–005
   la construyeron offline-first. *Descartada: añadir detección de conectividad
   (NetInfo/`expo-network`) con lógica o pantalla de estado* — requiere una dependencia
   nueva (constitución 1), contradice RF-8 (nada visible debe cambiar sin red) y no
   aporta a ningún RF.
7. **Permiso `INTERNET` en el manifiesto se queda como está** (ratificada, decisión 1) —
   fuera de alcance: se verifica por código, pruebas y modo avión, no tocándolo.

## Estrategia de pruebas con Jest

Puerta de la constitución 4: todo en verde antes de avanzar. Comandos: `npx jest` y
`npx tsc --noEmit`.

| Suite (nueva o existente) | Qué comprueba | RF |
|---|---|---|
| `jest.setup.js` + **todas** las suites existentes (11) | Correr con la red bloqueada sin ninguna activación: son 251 pruebas que ejercitan temporizador, avisos, ajustes, storage y permisos **sin un solo fallo de la guardia** = prueba viviente de que la app es offline-first | RF-4, RF-7 |
| `__tests__/offline.test.ts` → autotest guardia | `fetch`, `XMLHttpRequest` y `WebSocket` lanzan al usarse: si alguien borra el setup, esta prueba lo delata | RF-7 |
| `__tests__/offline.test.ts` → dependencias | `package.json` sin patrones de anuncios/analítica/crash/telemetría | RF-10 |
| `__tests__/offline.test.ts` → escáner de URLs | Cero `http(s)://` en `app/`, `src/`, `app.json`, `metro.config.js` (el propio test queda fuera de scope; hoy verificado limpio) | RF-11 |
| `app/__tests__/boot.test.tsx` → almacenamiento vacío | Primer arranque: directo al temporizador con defaults, sin pantalla de cuenta ni de login | RF-1, RF-2 |
| `app/__tests__/boot.test.tsx` → basura en las 6 claves | Descarte silencioso: defaults 25/5/15/4 aplicados, cero `Alert`, sin bloqueo | RF-9 (y RF-3 de regresión: ningún modal de permiso se abre con datos corruptos) |
| `src/storage/__tests__/cycleStorage.test.ts` (existente, sin cambios) | Fallo de disco en lectura/escritura → `null` / best-effort; JSON corrupto → `null` | RF-5, RF-9 |
| `src/storage/__tests__/*Codec.test.ts` (existentes) | Validación estricta que convierte basura en `null` | RF-9 |
| `src/domain/__tests__/permission.test.ts` (existente) | Todas las ramas de arranque terminan en START | RF-3 |

**Comprobación de la configuración**: la tarea que introduce el setup verifica con
`npx jest --showConfig` que `setupFilesAfterEnv` apunta a `jest.setup.js` y que el
`setupFiles` del preset sigue intacto (defensa contra la trampa de la decisión 2).

**Lo que Jest NO cubre** (queda en la lista manual de `tasks.md`): modo avión real en
dispositivo (Escenario 2 de HU-006 con temporizador, avisos y ajustes), recorrido de
pantallas sin anuncios (Escenario 3), que el primer arranque en un build de producción
sí sea sin red (salvedad del bundle de desarrollo, decisión 4) y la pérdida de datos al
desinstalar (RF-6, decisión 3).

## Cobertura de todos los RF

| RF | Cómo se cubre |
|---|---|
| RF-1 | `boot.test.tsx` (vacío → temporizador) + lista manual Escenario 1 |
| RF-2 | `boot.test.tsx` (ningún texto de cuenta) + revisión manual: no existe pantalla de registro en la app |
| RF-3 | Regresión: `permission.test.ts` + `boot.test.tsx` (corrupto no abre modales) + lista manual del primer «Iniciar» |
| RF-4 | Guardia global en las 11 suites + lista manual en modo avión (salvedad del bundle de dev, decisión 4) |
| RF-5 | Pruebas existentes de `cycleStorage` + lista manual (ajuste → cerrar → reabrir) |
| RF-6 | Documentado en spec y en la lista manual (sin código, decisión 3) |
| RF-7 | Guardia global + autotest en `offline.test.ts` |
| RF-8 | Cero cambios de interfaz («no pintar nada» es el requisito) + lista manual: ningún indicador de red |
| RF-9 | `boot.test.tsx` (basura → defaults, sin diálogo) + pruebas existentes de storage/codecs |
| RF-10 | Test de patrones prohibidos + revisión manual documentada de `package.json` |
| RF-11 | Escáner de URLs + revisión manual de activos empaquetados |

RNF-1 y RNF-2: guardia + cero dependencias nuevas (el diff de `package.json` solo toca
`jest.setupFilesAfterEnv`). RNF-3: sin código de red ni de cuentas (se endosa con las
pruebas). RNF-4: escáner de URLs + interfaz intacta.

## Orden de ejecución propuesto (para `/sdd-tasks`)

1. `jest.setup.js` + `package.json` (guardia) y correr la suite completa: ver que las
   251 existentes siguen en verde con la red bloqueada.
2. `__tests__/offline.test.ts` (autotest + dependencias + escáner de URLs).
3. `app/__tests__/boot.test.tsx` (arranque vacío y corrupto).
4. Lista manual + verificación final (`npx jest`, `npx tsc --noEmit`) y cierre.
