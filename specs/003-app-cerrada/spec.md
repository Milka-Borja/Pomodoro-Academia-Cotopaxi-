# Spec 003 — Mantener el conteo con el celular bloqueado o la app cerrada

Estado: completada
HU de origen: docs/historias/HU-003.md

## Contexto y objetivo

El temporizador Pomodoro solo es útil si el alumno confía en que su tiempo de
estudio no se pierde por bloquear el celular o cerrar la aplicación. Esta spec
define cómo el conteo se mantiene exacto en esos casos, cómo se avisa del fin
de una fase aunque la app esté cerrada y cómo se recupera la sesión al volver.

## Usuarios

- Estudiante que usa el temporizador para sus sesiones de estudio y bloquea el
  celular o cierra la app mientras el tiempo corre.

## Historias de usuario

- HU-003: Mantener el conteo con el celular bloqueado o la app cerrada
  (docs/historias/HU-003.md). Escenarios: bloquear el celular; cerrar la
  aplicación; el tiempo termina con la aplicación cerrada; pausar antes de cerrar.

## Definiciones

- "Fase": periodo de estudio, descanso corto o descanso largo de la técnica
  Pomodoro.
- "Fase terminada": fase cuyo tiempo se cumplió mientras la app estaba cerrada
  o el celular bloqueado. Al abrir la app aparece como terminada y espera la
  acción del usuario; no avanza de fase por sí sola.

## Requisitos funcionales

- **RF-1:** CUANDO el usuario bloquea el celular con el temporizador en marcha y
  lo desbloquea más tarde, EL SISTEMA muestra el tiempo restante de la fase,
  descontando todo el tiempo transcurrido mientras estuvo bloqueado.
  *Origen: HU-003 Escenario 1; decisión 1.*

- **RF-2:** CUANDO el usuario cierra la aplicación con el temporizador en marcha
  y vuelve a abrirla, EL SISTEMA recupera la sesión en curso y muestra el tiempo
  restante correcto. *Origen: HU-003 Escenario 2; decisión 1.*

- **RF-3:** MIENTRAS la app no esté en primer plano, EL SISTEMA calcula el
  tiempo restante de forma exacta sin depender de que el proceso siga vivo en
  memoria. *Origen: decisión 1.*

- **RF-4:** CUANDO una fase se cumple con la app cerrada, EL SISTEMA envía el
  aviso de fin de fase. *Origen: HU-003 Escenario 3; decisión 3.*

- **RF-5:** EL SISTEMA envía el aviso de fin de fase en todas las fases:
  estudio, descanso corto y descanso largo. *Origen: decisión 3.*

- **RF-6:** CUANDO el usuario abre la app después de que una fase se cumplió con
  la app cerrada, EL SISTEMA muestra la fase como terminada y espera una acción
  explícita del usuario para iniciar la siguiente. *Origen: HU-003 Escenario 3;
  decisión 2.*

- **RF-7:** CUANDO se detecta que una fase de estudio se cumplió con la app
  cerrada, EL SISTEMA la cuenta como pomodoro completado para el ciclo.
  *Origen: decisión 8.*

- **RF-8:** CUANDO el usuario toca el aviso de fin de fase, EL SISTEMA abre la
  app directamente en la pantalla del temporizador, mostrando la fase terminada
  y el botón para iniciar la siguiente. *Origen: decisión 6.*

- **RF-9:** CUANDO el usuario pausa el temporizador y cierra la app, EL SISTEMA
  mantiene la fase en pausa con el mismo tiempo restante al reabrirla.
  *Origen: HU-003 Escenario 4.*

- **RF-10:** MIENTRAS el temporizador esté en pausa, EL SISTEMA no envía avisos
  de fin de fase. *Origen: HU-003 Escenario 4 ("no recibo ningún aviso").*

- **RF-11:** SI el usuario no ha concedido el permiso de notificaciones o las
  tiene desactivadas en el sistema, ENTONCES EL SISTEMA mantiene el temporizador
  exacto, muestra el estado correcto al abrir la app, informa una única vez de
  que las notificaciones están desactivadas y no vuelve a insistir.
  *Origen: decisión 4.*

- **RF-12:** CUANDO el celular se apaga o se reinicia con una fase en curso, EL
  SISTEMA recupera la sesión y muestra el tiempo restante exacto al abrir la
  app. *Origen: decisión 7.*

## Requisitos no funcionales

- **RNF-1:** El cálculo del tiempo restante no requiere conexión a internet.
  *Origen: constitución (principios 1 y 6); decisión 1.*

## Casos límite

- Cambio manual del reloj del dispositivo: altera el cálculo del tiempo
  restante. Aceptado como limitación conocida; no se detecta el cambio
  (decisión 1).
- App cerrada durante horas: al abrirla, la fase en curso aparece como
  terminada; no se avanzan automáticamente varias fases (decisión 2).
- Reinicio o apagado del celular: el tiempo se recupera con exactitud, pero el
  aviso de la fase que se cumplió durante el reinicio puede perderse
  (decisión 7).

## Fuera de alcance

- Avanzar de fase sin acción explícita del usuario (decisión 2).
- Detectar cambios del reloj del dispositivo (decisión 1).
- Garantizar el aviso de fin de fase después de un reinicio del celular
  (decisión 7).

## Criterios de finalización

- Los cuatro escenarios de HU-003 verificados con la lista manual de la tarea,
  con la salvedad de la decisión 5: la verificación manual en Expo Go cubre
  vuelta a la app con tiempo transcurrido, cierre y reapertura; la notificación
  en segundo plano se verifica en un development build cuando haya uno.
- La lógica de cálculo del tiempo pasa las pruebas automatizadas (constitución
  4).

## Dudas abiertas

- Sin dudas abiertas: las ocho preguntas de la entrevista de clarificación
  quedaron resueltas en `decisiones.md`.
