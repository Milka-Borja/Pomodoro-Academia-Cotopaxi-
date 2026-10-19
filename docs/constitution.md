# Constitución — Temporizador Pomodoro Academia Cotopaxi

Principios innegociables. Toda spec, plan y tarea debe cumplirlos.

1. Simplicidad primero: solo las dependencias que AGENTS.md autoriza. Cero publicidad y cero conexiones a internet innecesarias[cite: 3].
2. La spec manda: nada se implementa si no está en la spec activa. Si falta una decisión, se para y se pregunta.
3. Lógica separada de interfaz: las reglas del temporizador y los ciclos Pomodoro viven en funciones puras de `src/domain`, sin React ni almacenamiento.
4. Pruebas como puerta: la lógica se prueba con Jest. Prohibido avanzar con pruebas en rojo. La interfaz se verifica con la lista manual de la tarea.
5. Los datos del usuario son sagrados: los ajustes de tiempos y el estado de la sesión se conservan de forma estrictamente local. La aplicación jamás debe pedir crear una cuenta.
6. Exactitud en el tiempo: el temporizador debe mantener el conteo riguroso y enviar las notificaciones correspondientes incluso con el celular bloqueado o la app cerrada. Cómo se logra se decide en la spec y en el plan, y se justifica.
7. Identidad visual innegociable: el diseño de la aplicación debe ser intuitivo y estar estrictamente acoplado con los colores de la Academia Cotopaxi.