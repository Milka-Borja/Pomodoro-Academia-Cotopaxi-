# Spec 001 — Iniciar y controlar una sesión de estudio

Estado: Aprobada
HU de origen: docs/historias/HU-001.md (Iniciar y controlar una sesión de estudio)

## Contexto y objetivo

El estudiante necesita concentrarse durante un tiempo definido. Esta spec cubre el control completo de la fase de estudio del temporizador: iniciar la cuenta regresiva, pausarla, reanudarla y reiniciarla con confirmación. El contador debe ser exacto incluso cuando la pantalla se bloquee o la app pase a segundo plano. Los descansos, el ciclo de pomodoros y las notificaciones pertenecen a historias posteriores.

## Usuarios

- Estudiante: única persona usuaria de la app. No hay cuentas ni registro.

## Historias de usuario

HU-001 describe cuatro escenarios, todos cubiertos por esta spec:

1. **Iniciar el temporizador:** desde la pantalla principal, al presionar iniciar, la cuenta regresiva comienza con el tiempo de estudio configurado y se ven los minutos y segundos que faltan.
2. **Pausar y continuar:** con el temporizador corriendo, pausarlo y reanudarlo hace que la cuenta siga desde el tiempo en que se pausó.
3. **Reiniciar el temporizador:** con el temporizador corriendo o pausado, reiniciarlo y confirmarlo devuelve el temporizador al tiempo inicial de la fase.
4. **Cambiar de opinión al reiniciar:** al decidir reiniciar y cancelar la confirmación, el temporizador conserva el tiempo que llevaba, sin aplicar ningún cambio (la cuenta siguió su propia marcha durante el diálogo; RF-10).

## Definiciones

- **Fase de estudio:** única fase contemplada en esta spec. Se ejecuta con el tiempo de estudio configurado.
- **Tiempo inicial de estudio:** el valor del tiempo de estudio configurado al momento de iniciar o reiniciar una ronda. Dentro de HU-001 ese valor es el por defecto de estudio: 25 minutos.
- **Ronda de estudio:** período que comienza al pulsar «Iniciar» (o al confirmar «Reiniciar» con el contador en 00:00) y termina al llegar a 00:00 o al reiniciarse.
- **mm:ss:** formato de visualización del tiempo restante en minutos y segundos.

## Requisitos funcionales

- **RF-1:** CUANDO el usuario presiona «Iniciar», EL SISTEMA comienza a descontar el tiempo de estudio configurado desde el momento de la pulsación. Dentro de HU-001, el tiempo de estudio configurado es el valor por defecto de 25 minutos. *(Origen: HU-001 Escenario 1; Decisión 9)*
- **RF-2:** EL SISTEMA muestra permanentemente el tiempo restante en formato mm:ss. *(Origen: HU-001 Escenario 1; Decisión 7)*
- **RF-3:** CUANDO el temporizador está corriendo y el usuario lo pausa, EL SISTEMA detiene el conteo en el tiempo restante exacto. *(Origen: HU-001 Escenario 2)*
- **RF-4:** CUANDO el temporizador está pausado y el usuario lo reanuda, EL SISTEMA continúa descontando desde el tiempo en que se pausó. *(Origen: HU-001 Escenario 2)*
- **RF-5:** MIENTRAS la app esté en segundo plano o el celular esté bloqueado, EL SISTEMA calcula el tiempo restante de forma exacta, de modo que al volver a verse la pantalla el contador muestre el valor correcto. *(Origen: Decisión 8)*
- **RF-6:** CUANDO la cuenta regresiva llega a 00:00, EL SISTEMA detiene el conteo, clava el valor en 00:00 sin mostrar números negativos y deja al usuario iniciar otra ronda o reiniciar. *(Origen: Decisión 4)*
- **RF-7:** CUANDO el contador está en 00:00 y el usuario presiona «Iniciar», EL SISTEMA vuelve al tiempo inicial de estudio y comienza una nueva ronda automáticamente. *(Origen: Decisión 4; Decisión 10)*
- **RF-8:** CUANDO el usuario presiona «Reiniciar», EL SISTEMA muestra un diálogo de confirmación con las acciones «Cancelar» y «Reiniciar», sin detener la cuenta: mientras el diálogo esté abierto, la cuenta sigue descontando si estaba corriendo y permanece pausada si estaba pausada. *(Origen: HU-001 Escenario 3; Decisión 6; Decisión 11)*
- **RF-9:** CUANDO el usuario confirma el reinicio con el temporizador corriendo o pausado (contador distinto de 00:00), EL SISTEMA vuelve al tiempo inicial de estudio y se detiene, esperando que el usuario pulse «Iniciar» para correr de nuevo. *(Origen: HU-001 Escenario 3; Decisión 5)*
- **RF-10:** CUANDO el usuario cancela la confirmación del reinicio, EL SISTEMA descarta el diálogo sin ningún cambio: si estaba corriendo, la cuenta sigue descontando desde donde iba al abrirse el diálogo; si estaba pausada, permanece pausada. *(Origen: HU-001 Escenario 4; Decisión 6; Decisión 11)*
- **RF-11:** EL SISTEMA ofrece en la pantalla principal únicamente la cuenta regresiva, un botón que alterna entre «Iniciar» y «Pausar/Reanudar», y el botón «Reiniciar», sin etiqueta de fase ni contador de pomodoros. *(Origen: Decisión 7)*
- **RF-12:** CUANDO el contador está en 00:00 y el usuario confirma «Reiniciar», EL SISTEMA vuelve al tiempo inicial de estudio y comienza una nueva ronda automáticamente. *(Origen: Decisión 4; Decisión 12)*

## Requisitos no funcionales

- **RNF-1:** La aplicación funciona sin conexión a internet, sin registro y sin publicidad. *(Origen: HU-006; constitución, principios 1 y 5)*
- **RNF-2:** La interfaz utiliza la identidad visual de la Academia Cotopaxi y es intuitiva para el estudiante. *(Origen: constitución, principio 7)*

## Casos límite

- **Llegar a 00:00:** el comportamiento mínimo dentro de HU-001 es el del RF-6, y una nueva ronda puede comenzar con «Iniciar» según el RF-7 o confirmando «Reiniciar» según el RF-12. La transición automática al descanso y su aviso quedan fuera (Decisión 1).
- **Cerrar o forzar el cierre de la app con la sesión en curso:** el estado de la sesión se pierde; no hay restauración en esta spec (Decisión 3).
- **Cambiar el tiempo de estudio mientras corre la cuenta:** fuera del alcance de esta spec (HU-005).
- **Pausar con el contador ya en 00:00:** el conteo ya está detenido por el RF-6; no hay tiempo restante que pausar.

## Fuera de alcance

- Transición automática de fase al llegar a 00:00, avisos y notificaciones al terminar el tiempo (Decisiones 1 y 8; HU-002, HU-003, HU-004).
- Fases de descanso corto y largo, ciclo de pomodoros y contador de pomodoros (Decisión 2).
- Persistencia y restauración del estado de la sesión tras cierre y reapertura de la app (Decisión 3).
- Pantalla de ajustes para cambiar los tiempos (HU-005).

## Criterios de finalización

- Los cuatro escenarios de HU-001 quedan cubiertos: la lógica verificada con pruebas Jest en verde y la interfaz verificada con la lista manual en Expo Go.
- La cuenta regresiva muestra el valor correcto al volver de segundo plano o de pantalla bloqueada (RF-5).
- Sin dependencias nuevas fuera de las autorizadas por AGENTS.md (constitución, principio 1).

## Dudas abiertas

- Ninguna. Las dos dudas que marcaban `[NECESITA ACLARACIÓN]` quedaron resueltas como Decisión 9 y Decisión 10, y las dos contradicciones detectadas en la revisión `/sdd-clarify` quedaron resueltas como Decisión 11 y Decisión 12, todas en `decisiones.md`.
