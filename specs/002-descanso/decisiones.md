# Decisiones — HU-002 Alternar entre estudio y descanso

Documento derivado de la entrevista con el usuario (8 preguntas). No es la spec: solo registra las decisiones que cierran los huecos de `docs/historias/HU-002.md`. La spec se redacta aparte, respetando `docs/constitution.md`.

---

## Decisión 1 — Regla de cambio de fase al llegar a 00:00

**Pregunta:** La HU-002 se contradice: la descripción dice que la aplicación «pase sola» del tiempo de estudio al de descanso, pero los escenarios dicen «deja listo un descanso corto para que yo lo inicie» y «deja listo el siguiente tiempo de estudio». ¿Qué debe pasar cuando una fase llega a 00:00, en ambas direcciones (estudio → descanso y descanso → estudio)?

**Respuesta del usuario:** La app deja la siguiente fase lista, esperando que el usuario pulse «Iniciar». Igual en ambas direcciones.

**Motivo:** Son los criterios de aceptación, la fuente más concreta de la historia, quienes usan «deja listo... para que yo lo inicie»; «pase sola» se interpreta como que el cambio de fase lo realiza la app sin que el usuario tenga que elegirlo, no que la cuenta nueva arranche sola. Al llegar a 00:00 el contador se clava en 00:00 (regla de la skill `pomodoro-rules`), la pantalla pasa a mostrar la siguiente fase con su tiempo completo (por ejemplo 05:00) detenido, y solo la pulsación de «Iniciar» comienza la cuenta. Mantiene estados en reposo predecibles, coherente con la Decisión 5 de HU-001, y evita arranques automáticos que el usuario no pidió.

---

## Decisión 2 — Momento del incremento y del cero del contador de pomodoros

**Pregunta:** La HU-002 dice que «el contador de pomodoros vuelve a cero» cuando queda listo el descanso largo, pero la skill `pomodoro-rules` dice que vuelve a cero «después de un Descanso Largo». ¿Cuándo sube el contador y cuándo se pone a cero?

**Respuesta del usuario:** El contador sube al terminar cada tiempo de estudio y baja a 0 al quedar listo el descanso largo (redacción literal de la HU-002).

**Motivo:** Los criterios de aceptación de la propia historia mandan: «completé la cantidad de pomodoros configurada... la aplicación deja listo un descanso largo y el contador de pomodoros vuelve a cero». Así nunca se ve «4 pomodoros» mientras ya se entregó el descanso largo: durante todo ese descanso el contador se muestra en 0 (y los puntos del ciclo, vacíos). **Resolución (/sdd-clarify):** validada. La HU-002 tiene prioridad normativa sobre la skill `pomodoro-rules`: el contador vuelve a cero exactamente cuando se completa el estudio y queda listo el descanso largo, como exige el escenario 2 de la historia. La excepción a la regla de la skill («después de un Descanso Largo») queda explícita en el RF-2 de la spec.

---

## Decisión 3 — Controles durante la fase de descanso

**Pregunta:** HU-001 definió iniciar, pausar y reiniciar solo para la fase de estudio. En un descanso (corto o largo), ¿qué controles debe tener el usuario?

**Respuesta del usuario:** Mismos controles que en estudio: iniciar, pausar/reanudar y reiniciar con confirmación.

**Motivo:** Reutiliza la lógica ya construida y probada en HU-001 sin reglas nuevas ni dependencias (constitución, principios 1 y 3): una sola lógica de control de fase aplicada a cualquier fase. «Reiniciar» durante un descanso vuelve al tiempo inicial de ese descanso y no toca el contador de pomodoros (la skill indica que el reinicio «conserva su progreso en el ciclo»). Sin esta decisión, un descanso quedaría sin control posible de pausa.

---

## Decisión 4 — Saltar el descanso o terminar el ciclo

**Pregunta:** La HU-002 no menciona qué puede hacer el usuario si no quiere hacer el descanso o quiere cortar el ciclo entero. ¿Debe existir esa opción en esta historia?

**Respuesta del usuario:** Ninguna opción: fuera de alcance de HU-002.

**Motivo:** La spec manda: la historia no pide esos controles y la constitución ordena simplicidad primero. El usuario espera el descanso y, cuando la fase de estudio quede lista, la inicia. Queda registrado como pendiente para una historia futura, que además deberá decidir qué efecto tendría saltar un descanso sobre el contador de pomodoros.

---

## Decisión 5 — Fuente de los tiempos y de la cantidad de pomodoros dentro de HU-002

**Pregunta:** HU-001 resolvió su hueco con «25 minutos por defecto» hasta que exista la pantalla de ajustes (HU-005). ¿Con qué valores trabaja HU-002 para el descanso corto, el descanso largo y la cantidad de pomodoros del ciclo?

**Respuesta del usuario:** Valores por defecto fijos: 5 minutos de descanso corto, 15 de descanso largo y 4 pomodoros por ciclo.

**Motivo:** Los tiempos salen de la skill `pomodoro-rules` y la cantidad la propio de la historia («cuatro por defecto»). Mismo patrón que la Decisión 9 de HU-001: cuando HU-005 agregue ajustes solo cambia la fuente del dato, sin tocar la lógica de cambio de fase. No implica definir un formato nuevo de datos guardados (límite de AGENTS.md).

---

## Decisión 6 — Límite con el segundo plano y el cierre de la app

**Pregunta:** La constitución (principio 6) y HU-003 exigen exactitud con el celular bloqueado o la app cerrada. ¿Hasta dónde llega HU-002 con las fases de descanso?

**Respuesta del usuario:** Con la app viva (segundo plano o celular bloqueado) la transición sí está garantizada; sobrevivir al cierre de la app queda para HU-003.

**Motivo:** Se reutiliza el mecanismo de marcas de tiempo absolutas decidido en la Decisión 8 de HU-001: si un estudio llega a 00:00 mientras la pantalla está bloqueada o la app está en segundo plano, al volver a verse la pantalla se muestra la siguiente fase lista, con el tiempo calculado. La persistencia de fase, tiempo y contador en AsyncStorage la exige HU-003 («la aplicación recupera la sesión»); definir su formato aquí adelantaría una decisión de datos guardados que AGENTS.md pide preguntar antes de tomar.

---

## Decisión 7 — Elementos que agrega HU-002 a la pantalla principal

**Pregunta:** HU-002 exige «ver si estoy en estudio o en descanso y cuántos pomodoros llevo en el ciclo actual», pero la Decisión 7 de HU-001 dejó la pantalla sin etiqueta de fase ni contador. ¿Qué elementos mínimos agrega HU-002?

**Respuesta del usuario:** Etiqueta con el nombre de la fase y una fila de 4 puntos que se llenan según los pomodoros completados del ciclo.

**Motivo:** Satisface el escenario «Ver mi avance» con el cambio mínimo sobre la pantalla de HU-001 (constitución, principio 1). La etiqueta distingue «Estudio», «Descanso corto» y «Descanso largo»; los puntos reflejan el contador de la Decisión 2 (quedan vacíos durante el descanso largo, porque el contador ya volvió a 0). Los colores salen de `src/theme/colors.ts` siguiendo la skill `cotopaxi-brand` (principio 7), sin dependencias nuevas.

---

## Decisión 8 — Contador de pomodoros al reiniciar o abandonar un estudio

**Pregunta:** La skill `pomodoro-rules` dice que reiniciar «conserva su progreso en el ciclo» y que un estudio cancelado o que no llega a 00:00 «no cuenta». Cuando el usuario reinicia (o abandona) un estudio a mitad, ¿qué pasa con los pomodoros ya acumulados en el ciclo?

**Respuesta del usuario:** Se conserva el avance del ciclo.

**Motivo:** Aplica literalmente la regla de la skill, sin improvisar. Además unifica el comportamiento en una regla única y fácil de recordar: «reiniciar siempre vuelve al tiempo inicial de la fase actual y nunca altera el contador» (Decisión 5 de HU-001 para estudio; Decisión 3 de esta historia para descansos). Solo cuenta para el avance el estudio que llega a 00:00, que es justo lo que incrementa el contador (Decisión 2).

**Resolución (/sdd-clarify):** «Abandonar» se aclara como cancelar el temporizador en curso usando los controles de la interfaz (el botón «Reiniciar»). El comportamiento ante el cierre de la aplicación queda fuera de alcance y se resuelve en HU-003 (Decisión 6). El RF-7 de la spec lo refleja.

---

## Resumen de lo que queda pendiente en otras historias

- Avisos y notificaciones al terminar una fase (HU-004).
- Persistencia y restauración de fase, tiempo y contador tras cierre de la app; exactitud con la app cerrada por completo (HU-003; Decisión 6).
- Ajustes de tiempos y de la cantidad de pomodoros del ciclo (HU-005; Decisión 5).
- Saltar el descanso o terminar el ciclo manualmente (Decisión 4).
