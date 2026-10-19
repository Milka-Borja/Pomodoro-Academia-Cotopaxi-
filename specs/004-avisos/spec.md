# Spec 004 — Recibir aviso al terminar el tiempo

Estado: completada
HU de origen: docs/historias/HU-004.md

## Contexto y objetivo

La promesa central de esta historia es que el alumno cambie de actividad sin estar mirando la pantalla: cuando el tiempo de estudio o de descanso termine, la app avisa aunque el celular esté en silencio, bloqueado o la app cerrada. Esta spec define qué ocurre cuando una fase llega a cero: qué se avisa, qué ve y oye el usuario según el estado del celular, cómo se detiene el aviso y cómo se pide el permiso de notificaciones y se invita —una sola vez— a activar «Alarmas y recordatorios» la primera vez.

## Usuarios

- Estudiante que usa el temporizador y quiere cambiar de actividad sin mirar la pantalla, incluso con el celular en silencio o bloqueado.

## Historias de usuario

- HU-004: Recibir aviso al terminar el tiempo (docs/historias/HU-004.md). Escenarios: aviso con el celular en sonido; aviso con el celular en silencio; detener el aviso; permiso de notificaciones.

## Definiciones

- "Fase": periodo de estudio, descanso corto o descanso largo de la técnica Pomodoro.
- "Aviso": conjunto de sonido, vibración y notificación que indica al usuario que una fase terminó y cuál fue.
- "Vista de alarma": vista de aviso de tamaño grande que enciende la pantalla y contiene un botón de detener.
- "Siguiente fase": la fase que sigue a la terminada dentro del ciclo Pomodoro.

## Requisitos funcionales

- **RF-1:** CUANDO el temporizador de una fase llega a cero, EL SISTEMA emite un aviso que indica qué fase terminó.
  *Origen: HU-004 Escenario 1.*

- **RF-2:** CUANDO el temporizador llega a cero con el celular en sonido, EL SISTEMA envía una notificación con sonido y vibración que dice qué fase terminó.
  *Origen: HU-004 Escenario 1.*

- **RF-3:** CUANDO el temporizador llega a cero con el celular en modo silencio o vibración, EL SISTEMA suena como alarma, vibra y muestra el aviso en la pantalla de bloqueo.
  *Origen: HU-004 Escenario 2; decisión 1.*

- **RF-4:** CUANDO el aviso se emite con el celular bloqueado, EL SISTEMA enciende la pantalla con una vista de alarma grande y un botón de detener.
  *Origen: HU-004 Escenario 2; decisión 2.*

- **RF-5:** SI el dispositivo es iOS, ENTONCES el aviso no enciende la pantalla y, en modo silencio, no reproduce sonido: se limita a la vibración y a la notificación en pantalla de bloqueo, documentándose esta limitación del sistema como conocida.
  *Origen: decisión 1; decisión 2.*

- **RF-6:** CUANDO el temporizador llega a cero con la app abierta en primer plano, EL SISTEMA reproduce la alarma completa —sonido y vibración— y muestra en pantalla la fase terminada.
  *Origen: decisión 3.*

- **RF-7:** CUANDO el usuario toca el botón de detener de la vista de alarma, EL SISTEMA detiene el sonido y la vibración y abre la app mostrando la fase terminada con su botón para iniciar la siguiente, de forma idéntica al comportamiento de RF-8.
  *Origen: HU-004 Escenario 3; decisión 6; decisión 10.*

- **RF-8:** CUANDO el usuario toca la notificación, EL SISTEMA abre la app mostrando la fase terminada con su botón para iniciar la siguiente; al abrirse, el aviso se detiene.
  *Origen: HU-004 Escenario 3; decisión 6; decisión 10.*

- **RF-9:** SI el usuario no toca la notificación ni el botón de detener, ENTONCES el sonido y la vibración se detienen solos tras unos 30 segundos y la notificación permanece en la bandeja hasta que él la atienda.
  *Origen: decisión 4; decisión 9.*

- **RF-10:** CUANDO el usuario toca Iniciar por primera vez sin haber concedido el permiso de notificaciones, EL SISTEMA muestra primero su propia explicación de por qué necesita el permiso y, cuando el usuario continúa, solicita el permiso.
  *Origen: HU-004 Escenario 4; decisión 5.*

- **RF-11:** SI el usuario rechaza el permiso de notificaciones, ENTONCES EL SISTEMA mantiene el temporizador funcionando sin avisos de fin de fase, informa una sola vez y no vuelve a solicitar el permiso.
  *Origen: decisión 5 (degradación de la decisión 4 de la spec 003).*

- **RF-12:** CUANDO EL SISTEMA emita el aviso, usa el tono de alarma por defecto del dispositivo, sin tonos propios de la app.
  *Origen: decisión 8.*

- **RF-13:** CUANDO el usuario inicia una sesión con el permiso de notificaciones concedido en un dispositivo Android 12 o superior y la invitación todavía no se ha mostrado, EL SISTEMA muestra una vez su propia explicación de que activar «Alarmas y recordatorios» hace que el aviso llegue a la hora exacta, con la opción de abrir la pantalla del sistema o de continuar sin activarlo; ninguna de las dos opciones impide que la sesión arranque.
  *Origen: observación 1 de la validación de 004 (cambio 1).*

- **RF-14:** SI el usuario no activa «Alarmas y recordatorios» —o lo desactiva más adelante—, ENTONCES el aviso sigue emitiéndose con los mecanismos normales de notificación programada, pudiendo no llegar a la hora exacta, la app informa una sola vez de esta limitación y no vuelve a invitar; el temporizador nunca se bloquea.
  *Origen: decisión 7 (best effort) condicionada por el cambio 1.*

## Requisitos no funcionales

- **RNF-1:** El aviso no requiere conexión a internet. *Origen: constitución (principios 1 y 6).*

- **RNF-2:** La vista de alarma y la notificación usan la identidad visual de la Academia Cotopaxi; el sonido es el del sistema. *Origen: constitución (principio 7); decisión 8.*

- **RNF-3:** El aviso no exige configuración ni permisos para funcionar: pide el permiso de notificaciones y solo sugiere, opcional y una sola vez, activar «Alarmas y recordatorios» (RF-13); nada de esto bloquea el temporizador y cualquier omisión degrada el aviso, nunca la app. *Origen: decisión 5; decisión 7 condicionada por el cambio 1.*

## Casos límite

- Celular en reposo prolongado o con optimización de batería agresiva: con «Alarmas y recordatorios» activo el aviso llega a la hora programada; sin él, se emite con los mecanismos normales de notificación programada y puede retrasarse o, en algunos casos, no llegar (hallazgo del diagnóstico de T8). La optimización de batería no se pide tocar (decisión 7).
- Aviso ignorado: si el usuario no lo atiende, el sonido para solo tras un tiempo limitado y la notificación permanece en la bandeja hasta que la atienda (decisión 4).
- iOS con el celular en silencio: sin sonido y sin encender la pantalla; vibra y muestra la notificación en la pantalla de bloqueo (decisiones 1 y 2).
- Permiso de notificaciones rechazado o desactivado en el sistema: el temporizador sigue exacto, no llegan avisos de fin de fase y solo se informa una vez (decisión 5, apoyada en la decisión 4 de la spec 003).
- Plataformas sin «Alarmas y recordatorios» (iOS y Android anteriores a 12): la invitación de RF-13 no se muestra nunca; el comportamiento de RF-5 sigue intacto.
- Permiso de notificaciones no concedido (RF-11): no se muestra la invitación de RF-13, porque no habrá aviso que puntualizar.
- Usuario que abre la pantalla del sistema y no activa el conmutador, o que lo desactiva después desde Ajustes: la app informa una sola vez y no vuelve a invitar (una sola invitación por instalación; RF-13 y RF-14).
- No es posible comprobar desde la app si «Alarmas y recordatorios» ya está concedido: la invitación se muestra igual una sola vez por instalación; si ya estaba activo, abrir la pantalla no cambia nada.

## Salvedad (desviación técnica conocida)

- Si el usuario no activa «Alarmas y recordatorios» (RF-13/RF-14), se acepta como desviación técnica conocida frente al principio 6 de la constitución que el aviso pueda no llegar a la hora exacta —incluidos retrasos en modo de ahorro de batería extremo (Doze)—; se usan los mecanismos normales de notificación programada, sin insistir en la invitación. La decisión 7 queda condicionada por este cambio.

## Fuera de alcance

- Repetir o posponer la alarma (snooze) hasta que el usuario la detenga (decisión 4).
- Pedir al usuario que desactive la optimización de batería (decisión 7).
- Volver a invitar a «Alarmas y recordatorios» o insistir tras un rechazo: una sola invitación por instalación y un solo informe (RF-13, RF-14).
- Garantizar la puntualidad del aviso sin el permiso de alarmas exactas (límites del sistema; RF-14 asume la degradación honesta).
- Tonos de alarma propios de la app (decisión 8).
- Sonido con el celular en silencio y encendido de pantalla estilo despertador en iOS (decisiones 1 y 2).

## Criterios de finalización

- Los cuatro escenarios de HU-004 verificados con la lista manual de la tarea, con la salvedad de la decisión 5 de la spec 003: la verificación manual en Expo Go cubre lo que el entorno permite y el aviso con la app cerrada se verifica en un development build cuando haya uno.
- La lógica del aviso pasa las pruebas automatizadas (constitución 4).
- RF-13 y RF-14: la lógica de la invitación única y del informe único pasa pruebas automatizadas; el flujo (explicación → pantalla del sistema → vuelta sin insistir) se verifica manualmente en Expo Go donde el entorno lo permite (principio 4).

