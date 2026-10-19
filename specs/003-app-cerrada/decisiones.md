# Decisiones — HU-003: Mantener el conteo con el celular bloqueado o la app cerrada

Preguntas de la entrevista de clarificación, en orden. Cada decisión registra la
pregunta, la respuesta del usuario y el motivo.

## 1. Mecanismo de exactitud del tiempo

**Pregunta:** ¿Cómo calculamos el tiempo restante cuando la app vuelve a primer
plano?

**Respuesta:** Timestamp de inicio. Al iniciar o pausar la fase se guarda un
timestamp (`startedAt` + duración) y al volver se calcula
`restante = fin - now`.

**Motivo:** Es el mecanismo más simple y resistente: el cálculo no depende de
que el proceso en memoria siga vivo ni de guardados periódicos, así que sobrevive
a app cerrada y a congelamiento del proceso. Se acepta como limitación conocida
que un cambio manual del reloj del dispositivo altere el cálculo (riesgo menor
para un proyecto académico; se descarta la detección de cambios de reloj por
complejidad innecesaria).

## 2. Comportamiento cuando una fase termina con la app cerrada

**Pregunta:** ¿Se avanza sola a la siguiente fase o se detiene esperando al
usuario? ¿Y si la app estuvo cerrada varias horas?

**Respuesta:** Se detiene y espera acción. Al abrir la app, la fase aparece como
terminada y el usuario decide cuándo iniciar la siguiente.

**Motivo:** Es lo que dice literalmente el escenario 3 de HU-003 ("la fase
aparece como terminada"). Evita que un descanso se gaste sin que nadie lo vea y
evita perder la referencia de en qué fase estaba el alumno si el celular estuvo
horas cerrado (varias fases podrían haberse "cumplido" en vano). Coherente con
la decisión 8: la fase cumplida sí cuenta para el ciclo, pero el avance se
produce solo con acción explícita.

## 3. Alcance de las notificaciones en segundo plano

**Pregunta:** ¿Qué fases deben generar notificación cuando terminan en
segundo plano: solo las de estudio o también los descansos?

**Respuesta:** Todas las fases: estudio, descanso corto y descanso largo.

**Motivo:** Cada fase de la técnica Pomodoro tiene su aviso, esté o no abierta
la app. Notificar solo el fin de estudio dejaría al alumno extender el descanso
sin darse cuenta, lo cual rompe la lógica del método. El escenario 3 dice "el
aviso de fin" sin restringirlo a estudio.

## 4. Comportamiento sin permiso de notificaciones

**Pregunta:** ¿Qué pasa si el usuario denegó los permisos de notificaciones o
las desactivó del sistema?

**Respuesta:** Degradar en silencio con un aviso único. El temporizador sigue
siendo exacto (timestamp) y la app muestra el estado correcto al abrir; el aviso
de fin no llega. Solo se informa una vez que las notificaciones están
desactivadas.

**Motivo:** La exactitud del tiempo (decisión 1) no depende de las
notificaciones, así que la promesa central de la historia se mantiene. Bloquear
el uso del temporizador sin permiso sería hostil para usuarios que simplemente
no quieren notificaciones, y recordarlo en cada inicio de fase sería ruidoso.
Se cumple además el límite de AGENTS.md de no insistir con diálogos repetidos.

## 5. Entorno de verificación del escenario de notificación en background

**Pregunta:** ¿Cómo verificamos el escenario "el tiempo termina con la app
cerrada y llega la notificación" si Expo Go tiene limitaciones con
notificaciones en segundo plano y task-manager?

**Respuesta:** Spec completa, verificación parcial en Expo Go. La spec define el
comportamiento completo (notificación en background incluida); la verificación
manual en Expo Go cubre lo que Expo Go permite (volver a la app con tiempo
transcurrido, cierre y reapertura); el caso de la notificación se prueba en un
development build cuando haya uno.

**Motivo:** La constitución exige que la spec mande y que la verificación sea la
lista manual de la tarea, pero no se puede exigir lo que el entorno de pruebas
no soporta. Dejar el alcance completo en la spec evita que la historia quede
truncada, y posponer la verificación de la notificación a un development build
evita instalar dependencias o procesos nuevos sin necesidad (límite de
AGENTS.md). Se documenta así la diferencia entre "definido" y "verificado".

## 6. Al tocar la notificación de fin de fase

**Pregunta:** ¿Dónde debe abrirse la app cuando el usuario toca la notificación?

**Respuesta:** Directo a la pantalla del temporizador, mostrando la fase
terminada y el botón para iniciar la siguiente.

**Motivo:** Menos fricción para el alumno: toca la notificación justamente para
continuar su sesión, y que tenga que navegar desde la pantalla de inicio sería
un paso innecesario. La fase terminada ya está calculada (decisión 2), así que
el botón de acción siguiente está siempre disponible.

## 7. Reinicio del celular con la app cerrada

**Pregunta:** ¿Qué pasa si el celular se apaga o se reinicia con una fase en
curso?

**Respuesta:** Tiempo exacto, notificación best effort. Al abrir la app el estado
se recupera del almacenamiento local (timestamp) y el tiempo sigue siendo
correcto; la notificación de la fase que se cumplió durante el reinicio puede
perderse y se documenta como limitación conocida.

**Motivo:** El timestamp persistido (decisión 1) sobrevive a un reinicio porque
el cálculo es puro: no depende de que la notificación programada haya existido.
Programar notificaciones resistentes a reinicio añadiría complejidad de
plataforma (y de permisos de alarmas exactas en Android) para un caso poco
frecuente en un proyecto académico. La promesa de la historia es no perder el
tiempo de estudio, y esa se cumple.

## 8. Conteo del ciclo cuando una fase se cumple en background

**Pregunta:** Si la fase de estudio terminó con la app cerrada, ¿ese pomodoro
cuenta para el ciclo (y para el descanso largo tras el 4.º)?

**Respuesta:** Sí, cuenta al detectarse.

**Motivo:** El alumno que estudió 25 minutos completos no debe perder su avance
en el ciclo por haber tenido la app cerrada; sería castigo, no precisión. Se
suma en cuanto se detecta que la fase se cumplió (al abrir la app), manteniendo
la decisión 2 de no avanzar de fase sin acción del usuario: la fase cuenta como
cumplida, pero el inicio del descanso correspondiente sigue siendo decisión del
usuario.
