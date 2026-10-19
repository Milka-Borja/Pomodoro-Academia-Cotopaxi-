# Spec 002 — Alternar entre estudio y descanso

Estado: Aprobada
HU de origen: docs/historias/HU-002.md

## Contexto y objetivo

HU-001 dejó un temporizador de estudio con iniciar, pausar y reiniciar. HU-002 hace que la aplicación maneje sola la alternancia entre fases: cuando termina un tiempo de estudio se entrega el descanso que corresponda, y cuando termina un descanso se entrega el siguiente tiempo de estudio, sin que el usuario tenga que elegir la fase ni llevar la cuenta de los pomodoros. El estudiante solo decide cuándo iniciar cada fase.

## Usuarios

- Estudiante que sigue la técnica Pomodoro durante sus sesiones de estudio.

## Historias de usuario

HU-002 (docs/historias/HU-002.md): «Alternar entre estudio y descanso». Escenarios de aceptación:

1. Terminar un pomodoro: termina un tiempo de estudio y aún no se completaron los pomodoros necesarios → la app deja listo un descanso corto para que el usuario lo inicie.
2. Llegar al descanso largo: se completó la cantidad de pomodoros configurada (cuatro por defecto) y termina el último tiempo de estudio → la app deja listo un descanso largo y el contador de pomodoros vuelve a cero.
3. Terminar un descanso: termina un descanso corto o largo y el usuario vuelve a la aplicación → la app deja listo el siguiente tiempo de estudio.
4. Ver mi avance: estando en una sesión, el usuario mira la pantalla principal y ve si está en estudio o en descanso y cuántos pomodoros lleva en el ciclo actual.

## Definiciones

- **Pomodoro completado (estudio que cuenta):** un tiempo de estudio que llega a 00:00. Un estudio reiniciado o abandonado a mitad no cuenta.
- **Descanso corto / descanso largo:** fases de descanso de 5 y 15 minutos por defecto, respectivamente.
- **Ciclo:** ronda de pomodoros que separa un descanso largo del siguiente; cantidad por defecto: 4.
- **Contador de pomodoros:** cuántos pomodoros completados lleva el ciclo actual. Sube al terminar cada tiempo de estudio y vuelve a cero al quedar listo el descanso largo (nunca se muestra el máximo mientras el descanso largo ya esté listo: durante ese descanso el contador y los puntos están en cero).
- **Fase lista:** la siguiente fase, mostrada con su tiempo completo y detenida, a la espera de que el usuario pulse «Iniciar». La app cambia de fase sola, pero no arranca la cuenta sola.

## Requisitos funcionales

- **RF-1:** CUANDO termina un tiempo de estudio y todavía no se completaron los pomodoros necesarios para el descanso largo, EL SISTEMA deja listo un descanso corto: lo muestra con su tiempo completo detenido, esperando que el usuario pulse «Iniciar». *Origen: HU-002 Escenario 1; Decisión 1.*
- **RF-2:** CUANDO termina el último tiempo de estudio que completa la cantidad de pomodoros del ciclo, EL SISTEMA deja listo un descanso largo: lo muestra con su tiempo completo detenido, a la espera de «Iniciar», y el contador de pomodoros del ciclo vuelve a cero. El contador se pone a cero en ese instante (al quedar listo el descanso largo), no después de él: es una excepción explícita a la regla de la skill `pomodoro-rules`, validada porque la HU-002 tiene prioridad normativa. *Origen: HU-002 Escenario 2; Decisión 1; Decisión 2.*
- **RF-3:** CUANDO termina un descanso (corto o largo), EL SISTEMA deja listo el siguiente tiempo de estudio: lo muestra con su tiempo completo detenido, a la espera de que el usuario pulse «Iniciar». *Origen: HU-002 Escenario 3; Decisión 1.*
- **RF-4:** CUANDO un tiempo de estudio llega a 00:00, EL SISTEMA incrementa en uno el contador de pomodoros del ciclo actual. *Origen: Decisión 2.*
- **RF-5:** MIENTRAS el usuario esté en una fase de descanso (corto o largo), EL SISTEMA ofrece los mismos controles que en estudio: iniciar, pausar/reanudar y reiniciar con confirmación. *Origen: Decisión 3.*
- **RF-6:** CUANDO el usuario reinicia un descanso, EL SISTEMA vuelve al tiempo inicial de ese descanso y no modifica el contador de pomodoros. *Origen: Decisión 3.*
- **RF-7:** CUANDO el usuario reinicia o abandona un tiempo de estudio sin que llegue a 00:00, EL SISTEMA conserva el avance del ciclo: el contador de pomodoros no cambia. Abandonar significa cancelar el temporizador en curso usando los controles de la interfaz (el botón «Reiniciar»); el comportamiento ante el cierre de la aplicación queda fuera de alcance y se resuelve en HU-003. *Origen: Decisión 8; Decisión 6.*
- **RF-8:** MIENTRAS el usuario esté en una sesión, EL SISTEMA muestra en la pantalla principal una etiqueta con el nombre de la fase actual: «Estudio», «Descanso corto» o «Descanso largo». *Origen: HU-002 Escenario 4; Decisión 7.*
- **RF-9:** MIENTRAS el usuario esté en una sesión, EL SISTEMA muestra en la pantalla principal una fila de puntos —uno por pomodoro del ciclo, cuatro por defecto— que se llenan según los pomodoros completados del ciclo actual; mientras el descanso largo esté listo o en curso, los puntos aparecen vacíos porque el contador volvió a cero. *Origen: HU-002 Escenario 4; Decisión 2; Decisión 7.*
- **RF-10:** MIENTRAS la aplicación siga viva (en segundo plano o con el celular bloqueado), EL SISTEMA mantiene el cálculo del tiempo: CUANDO una fase llega a 00:00 en ese estado, al volver a verse la pantalla se muestra la siguiente fase lista con su tiempo completo, detenida. *Origen: HU-002 Escenario 3; Decisión 6.*
- **RF-11:** EL SISTEMA trabaja por defecto con 5 minutos de descanso corto, 15 minutos de descanso largo y 4 pomodoros por ciclo, hasta que existan los ajustes de la HU-005. *Origen: Decisión 5.*

## Requisitos no funcionales

- **RNF-1:** EL SISTEMA debe funcionar sin conexión a internet y sin publicidad. *Origen: docs/constitution.md, principio 1.*
- **RNF-2:** EL SISTEMA debe mostrar los elementos que agrega esta historia (etiqueta de fase y puntos de avance) con los colores corporativos de la Academia Cotopaxi. *Origen: Decisión 7; constitución, principio 7.*

## Casos límite

- Estudio que llega a 00:00 con la app en segundo plano o el celular bloqueado (app viva): al volver a verse la pantalla, la siguiente fase aparece lista con el tiempo calculado → RF-10 (Decisión 6).
- Estudio reiniciado o abandonado a mitad: no cuenta como pomodoro y el avance del ciclo se conserva → RF-7 (Decisión 8).
- Descanso reiniciado: vuelve a su tiempo inicial sin tocar el contador → RF-6 (Decisión 3).
- El contador nunca muestra «4 pomodoros» (o el máximo configurado) mientras el descanso largo ya está listo: el incremento y el cero son inmediatos → RF-2, RF-4, RF-9 (Decisión 2).
- Exactitud y recuperación con la aplicación cerrada por completo: no garantizadas en esta historia → HU-003 (Decisión 6).

## Fuera de alcance

- Saltar el descanso o terminar el ciclo manualmente: ninguna opción en esta historia; queda para una historia futura, que además decidirá qué efecto tendría sobre el contador (Decisión 4).
- Avisos y notificaciones al terminar una fase (HU-004).
- Persistencia y restauración de fase, tiempo y contador tras el cierre de la app; exactitud con la app cerrada (HU-003; Decisión 6).
- Ajustes de tiempos y de la cantidad de pomodoros del ciclo (HU-005; Decisión 5).

## Criterios de finalización

- Los cuatro escenarios de HU-002 pasan la verificación manual en el dispositivo (constitución, principio 4).
- La lógica de cambio de fase, contador de pomodoros y reinicio de fase está cubierta por pruebas automatizadas en verde (constitución, principio 4).
- Todos los RF son verificables y verificados; ningún punto de «Dudas abiertas» pendiente.
- Sin dependencias nuevas, sin conexión a internet y sin publicidad (constitución, principio 1; Decisión 3 y 7).

## Dudas abiertas

- Ninguna: los ocho huecos de HU-002 están resueltos en `specs/002-descanso/decisiones.md`. Los tres puntos detectados en `/sdd-clarify` quedaron resueltos (Decisión 2 y Decisión 8), y el cierre de la aplicación queda delegado en HU-003 (Decisión 6). Los pendientes delegados a otras historias figuran en «Fuera de alcance».
