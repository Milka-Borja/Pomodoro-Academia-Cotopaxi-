# Decisiones — HU-001 Iniciar y controlar una sesión de estudio

Documento derivado de la entrevista con el usuario (8 preguntas) y de la revisión QA `/sdd-clarify` (Decisión 11 y Decisión 12). No es la spec: solo registra las decisiones que cierran los huecos de `docs/historias/HU-001.md`. La spec se redacta aparte, respetando `docs/constitution.md`.

---

## Decisión 1 — Comportamiento al llegar a 00:00

**Pregunta:** La HU-001 no define qué ocurre cuando la cuenta regresiva llega a 00:00. ¿Cuál es el comportamiento esperado al terminar una fase de estudio?

**Respuesta del usuario:** Fuera del alcance de HU-001.

**Motivo:** La historia solo cubre iniciar, pausar y reiniciar. La transición automática a la fase de descanso y su notificación se decidirán en una historia/spec futura. HU-001 no crece en alcance. El mínimo que sí garantiza HU-001 al llegar a 00:00 queda definido en la Decisión 4.

---

## Decisión 2 — Alcance de fases

**Pregunta:** Si el fin de fase queda fuera de HU-001, ¿qué fases contempla esta historia? La HU-001 dice «vuelve al tiempo inicial de la fase en la que estoy», lo que sugiere varias fases, pero no las nombra.

**Respuesta del usuario:** Solo fase de estudio.

**Motivo:** Coherente con la Decisión 1: HU-001 maneja exclusivamente la fase de estudio con su tiempo configurado. Los descansos y el ciclo completo (4 pomodoros → descanso largo) se agregan en historias siguientes. La frase «de la fase en la que estoy» se interpreta en HU-001 como «el tiempo inicial de estudio configurado».

---

## Decisión 3 — Cierre y reapertura de la app

**Pregunta:** La constitución exige exactitud con la app cerrada o el celular bloqueado, pero la HU-001 no dice qué pasa al cerrar y reabrir la app con una sesión en curso. ¿Debe restaurarse el estado?

**Respuesta del usuario:** Fuera del alcance de HU-001.

**Motivo:** La restauración del estado tras cierre y reapertura se decide en una historia/spec futura de persistencia. Se documenta como riesgo: si HU-001 no persiste nada, el estado de la sesión se pierde al forzar el cierre de la app; la historia futura deberá definir qué se guarda y cuándo (los límites de «preguntar antes de cambiar el formato de los datos guardados» de AGENTS.md aplican).

---

## Decisión 4 — Mínimo garantizado al llegar a 00:00

**Pregunta:** Aunque el fin de fase quede fuera, el contador sí puede llegar a 00:00 dentro de HU-001. ¿Comportamiento mínimo que la historia sí debe garantizar?

**Respuesta del usuario:** El contador se clava en 00:00 y permite repetir.

**Motivo:** Consolida dos cosas: (a) la regla de la skill `pomodoro-rules` de que el temporizador nunca muestra números negativos (se clava en 00:00); (b) al llegar a 00:00 la cuenta deja de contar y el usuario puede pulsar «Iniciar» o «Reiniciar» para comenzar otra ronda de estudio, sin esperar la transición a descanso (Decisión 1). HU-001 cubre los casos de prueba de llegar a 00:00, pero no los de cambio de fase.

---

## Decisión 5 — Estado tras confirmar el reinicio

**Pregunta:** La HU-001 dice que al reiniciar «el temporizador vuelve al tiempo inicial de la fase», pero no dice si la cuenta vuelve a correr automáticamente o se queda detenida.

**Respuesta del usuario:** Se detiene y espera.

**Motivo:** Tras confirmar el reinicio, el temporizador queda en el tiempo inicial de estudio y el usuario debe pulsar «Iniciar» para que corra de nuevo. Da un estado reposo predecible y evita arranques accidentales inmediatamente después de un reinicio.

---

## Decisión 6 — Confirmación del reinicio

**Pregunta:** La HU-001 exige «lo confirmo» y un escenario de «cambiar de opinión y cancelar», pero no define cómo se pide la confirmación.

**Respuesta del usuario:** Diálogo nativo con confirmar/cancelar.

**Motivo:** Al pulsar «Reiniciar» aparece un diálogo nativo (tipo Alert) con un mensaje como «¿Reiniciar el temporizador?» y dos acciones: Cancelar y Reiniciar. Cancelar conserva el tiempo que llevaba (criterio de aceptación «Cambiar de opinión al reiniciar»). Cumple el criterio de la historia sin introducir dependencias nuevas (constitución, principio 1).

---

## Decisión 7 — Elementos de la pantalla principal

**Pregunta:** ¿Qué elementos mínimos debe mostrar la pantalla principal en el alcance de HU-001? La historia solo menciona «veo los minutos y segundos que faltan».

**Respuesta del usuario:** Cuenta regresiva + controles mínimos.

**Motivo:** La pantalla muestra solo la cuenta regresiva en mm:ss y los controles: un botón que alterna entre «Iniciar» y «Pausar/Reanudar», y el botón «Reiniciar». Sin etiqueta de fase y sin contador de pomodoros (el ciclo pertenece a historias futuras). Simplicidad primero (constitución, principio 1) y la spec manda: la historia solo pide ver minutos y segundos.

---

## Decisión 8 — Exactitud con la app en segundo plano

**Pregunta:** Con la restauración tras cierre fuera de alcance (Decisión 3), ¿dónde queda el límite respecto al principio 6 de la constitución (exactitud con el celular bloqueado o la app cerrada)?

**Respuesta del usuario:** Exactitud en segundo plano sí.

**Motivo:** HU-001 debe garantizar que el tiempo restante calculado sea exacto aunque la pantalla se bloquee o la app pase a segundo plano, usando marcas de tiempo absolutas (timestamps de fin calculados al iniciar/reanudar) en lugar de depender de la frecuencia de un `setInterval` (regla de la skill `pomodoro-rules`). Al volver a ver la pantalla, el contador muestra el valor correcto. Quedan fuera: el lanzamiento de notificaciones (historia futura) y la restauración tras cierre forzado de la app (Decisión 3). Es una decisión de arquitectura: sin timestamps absolutos desde el inicio, la lógica del dominio se reharía después.

---

## Decisión 9 — Fuente del tiempo de estudio dentro de HU-001

**Pregunta:** La HU-001 menciona «el tiempo de estudio que tengo configurado», pero la pantalla de ajustes pertenece a HU-005 y ninguna decisión definía de dónde provenía ese tiempo dentro de HU-001.

**Respuesta del usuario:** Valor por defecto de 25 minutos.

**Motivo:** HU-001 usa el tiempo por defecto de estudio (25 minutos, según la skill `pomodoro-rules`) como tiempo inicial de la fase. Cuando HU-005 agregue la pantalla de ajustes, la fase pasará a leer el valor configurado sin cambiar el comportamiento de HU-001: solo cambia la fuente del dato. Mantiene HU-001 acotada (constitución, principio 1) y la spec manda.

---

## Decisión 10 — Pulsar «Iniciar» con el contador en 00:00

**Pregunta:** La Decisión 4 permite «comenzar otra ronda» al llegar a 00:00, pero no definía qué ocurre al pulsar «Iniciar» estando el contador ya en 00:00.

**Respuesta del usuario:** Vuelve al tiempo inicial y corre.

**Motivo:** Al pulsar «Iniciar» con el contador en 00:00, el temporizador vuelve al tiempo inicial de estudio y comienza una nueva ronda automáticamente, sin pasar por «Reiniciar». Da sentido pleno a «comenzar otra ronda» de la Decisión 4 con un solo gesto y evita un estado muerto donde «Iniciar» no hace nada visible.

---

## Decisión 11 — Diálogo de confirmación con la cuenta en marcha

**Origen:** `/sdd-clarify` (contradicción detectada entre RF-1, RF-8 y RF-10).

**Pregunta:** Mientras está abierto el diálogo de confirmación del reinicio (Decisión 6), ¿sigue corriendo la cuenta regresiva? RF-10 exigía «conservar el tiempo restante que llevaba, sin ningún otro cambio», lo que dejaba sin definir lo que ocurría durante el diálogo.

**Respuesta del usuario:** Sigue corriendo de fondo mientras el diálogo está abierto; si se cancela, simplemente sigue su marcha.

**Motivo:** El diálogo no congela el temporizador: la cuenta descuenta con marcas de tiempo absolutas (Decisión 8) y, al cancelar, no hay ningún cambio que aplicar. Si el temporizador estaba pausado, permanece pausado: el diálogo no altera el estado.

---

## Decisión 12 — Reiniciar con el contador en 00:00

**Origen:** `/sdd-clarify` (contradicción entre la Decisión 4 y la Decisión 5 / RF-9).

**Pregunta:** La Decisión 4 permite pulsar «Reiniciar» en 00:00 «para comenzar otra ronda», pero la Decisión 5 dice que tras confirmar el reinicio el temporizador queda detenido esperando «Iniciar». ¿Qué ocurre al confirmar «Reiniciar» estando el contador en 00:00?

**Respuesta del usuario:** Vuelve al tiempo inicial de 25:00 y arranca automáticamente una nueva ronda.

**Motivo:** Excepción a la Decisión 5 aplicable solo cuando el contador está en 00:00: hace literal lo que dice la Decisión 4 y evita un paso extra tras agotar una ronda. Con el contador corriendo o pausado en un valor distinto de 00:00 se mantiene la Decisión 5 (se detiene y espera «Iniciar»). El diálogo de confirmación de la Decisión 6 sigue mostrándose también en 00:00.

---

## Resumen de lo que queda pendiente en otras historias

- Transición automática de fase, notificación/aviso al terminar y descansos (Decisiones 1 y 2).
- Persistencia y restauración del estado tras cierre y reapertura de la app (Decisión 3).
- Notificaciones y exactitud con app cerrada por completo (Decisión 8).
- Contador de pomodoros y ciclo completo (Decisión 2).
