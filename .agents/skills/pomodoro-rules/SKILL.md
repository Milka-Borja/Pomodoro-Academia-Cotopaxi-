---
name: pomodoro-rules
description: Úsala siempre que escribas, modifiques o revises código o textos que calculen, muestren o gestionen los tiempos, fases, transiciones o ciclos del método Pomodoro.
---

# Reglas de negocio del Temporizador Pomodoro

## Reglas
- Tiempos por defecto: Estudio = 25 minutos, Descanso Corto = 5 minutos, Descanso Largo = 15 minutos.
- Ciclo de Pomodoros: El sistema debe llevar la cuenta de los tiempos de estudio completados. Al completar el cuarto tiempo de estudio, la siguiente fase es un Descanso Largo.
- Transición: Después de un Descanso Largo, el contador de pomodoros vuelve a cero y la siguiente fase es de Estudio.
- Si una fase de estudio se cancela o no llega a cero, no cuenta para el avance del ciclo.
- Reinicio: Al reiniciar el temporizador, este vuelve al tiempo inicial de la fase actual, según la configuración guardada del usuario, conservando su progreso en el ciclo.

## Exactitud en el tiempo
- El cálculo del tiempo debe ser exacto incluso si el celular se bloquea o la app se cierra. Esto exige el uso de marcas de tiempo absolutas (timestamps de finalización calculados al inicio/reanudación) en lugar de depender de la frecuencia de un `setInterval`.
- El temporizador nunca debe mostrar números negativos. Si el tiempo calculado es menor a 0, se clava en 00:00 y gatilla la finalización de la fase.
- Validaciones en ajustes: Se rechazan valores menores o iguales a 0, textos o campos vacíos para los tiempos.

## Checklist de revisión
- [ ] ¿Se prueba la transición al Descanso Largo exactamente al terminar el 4to pomodoro?
- [ ] ¿El contador de pomodoros se reinicia correctamente a 0 tras un Descanso Largo?
- [ ] ¿Se calcula el tiempo restante basándose en la diferencia de timestamps absolutos para simular bloqueos de pantalla?
- [ ] ¿Se bloquean valores como `0`, `-5` o `vacío` en la pantalla de ajustes?
- [ ] ¿Si el usuario cambia los tiempos en ajustes, la fase actual termina con su tiempo original y el cambio aplica a la siguiente?

## Al terminar
Indica qué puntos del checklist has comprobado y cómo.