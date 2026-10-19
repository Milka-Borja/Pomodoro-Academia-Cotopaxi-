# Spec 005 — Ajustar los tiempos del pomodoro

Estado: aprobada
HU de origen: docs/historias/HU-005.md (HU-005: Ajustar los tiempos del pomodoro)

## Contexto y objetivo

La técnica Pomodoro sirve mejor a cada estudiante cuando puede adaptarla a su ritmo: hay quien necesita bloques más cortos de estudio y quien prefiere descansos más largos. Hoy la app trabaja siempre con los mismos valores y no deja cambiarlos. Esta spec define la pantalla de ajustes desde la que el estudiante cambia la duración del estudio, la de los dos descansos y la cantidad de pomodoros antes del descanso largo; con qué reglas se validan y guardan esos valores; y cómo se aplican sin alterar una sesión que ya está en marcha.

## Usuarios

- Estudiante que quiere adaptar los tiempos de la técnica a su propio ritmo de estudio.

## Historias de usuario

- HU-005: Ajustar los tiempos del pomodoro (docs/historias/HU-005.md). Escenarios: cambiar un tiempo; ingresar un valor no válido; volver a los valores por defecto; cambiar un tiempo con una fase en curso.

## Definiciones

- "Ajustes": pantalla desde la que se cambian los cuatro valores de la técnica.
- "Fase": periodo de estudio, descanso corto o descanso largo.
- "Fase iniciada": fase a la que ya se le puso en marcha su tiempo, esté corriendo o en pausa.
- "Ciclo": la ronda de pomodoros de estudio que precede al descanso largo; "contador de pomodoros": cuántos de esos estudios ya se completaron.
- "Restablecer": devolver los cuatro valores a los de por defecto de la técnica.
- "Guardar": confirmar los cambios escritos en ajustes.

## Requisitos funcionales

- **RF-1:** CUANDO el usuario cambia un tiempo y pulsa Guardar, EL SISTEMA pasa a usar el nuevo valor a partir de la próxima fase.
  *Origen: HU-005 Escenario 1.*

- **RF-2:** EL SISTEMA conserva los cambios guardados aunque la aplicación se cierre y se vuelva a abrir.
  *Origen: HU-005 Escenario 1.*

- **RF-3:** CUANDO el usuario pulsa Guardar con el formulario válido, EL SISTEMA cierra ajustes y vuelve a la pantalla principal sin mostrar ningún mensaje adicional.
  *Origen: decisión 8.*

- **RF-4:** SI el usuario sale de ajustes sin pulsar Guardar, ENTONCES EL SISTEMA descarta en silencio todo lo que haya escrito, sin preguntar.
  *Origen: decisión 2.*

- **RF-5:** CUANDO el usuario toca el icono de engranaje de la cabecera de la pantalla principal, EL SISTEMA abre la pantalla de ajustes.
  *Origen: decisión 3.*

- **RF-6:** MIENTRAS el usuario esté en la pantalla de ajustes, EL SISTEMA mantiene el temporizador en marcha: entrar a ajustes no lo pausa ni lo reinicia.
  *Origen: decisión 3.*

- **RF-7:** MIENTRAS una fase ya haya empezado —corriendo o en pausa—, EL SISTEMA la deja terminar con la duración con la que inició; las fases todavía no iniciadas toman el valor nuevo.
  *Origen: HU-005 Escenario 4; decisión 6.*

- **RF-8:** CUANDO el usuario cambia la cantidad de pomodoros antes del descanso largo con el ciclo en curso, EL SISTEMA mantiene el contador sin reiniciarlo y, al terminar la fase de estudio en curso, la revalida contra el valor nuevo: si el contador ya lo alcanzó, continúa con el descanso largo; si no, sigue contando hacia él.
  *Origen: decisión 4.*

- **RF-9:** CUANDO el usuario elige restablecer y lo confirma en el diálogo, EL SISTEMA persiste los cuatro valores por defecto —25 minutos de estudio, 5 de descanso corto, 15 de descanso largo y 4 pomodoros por ciclo—, cierra ajustes y vuelve a la pantalla principal sin requerir pulsar Guardar y sin mostrar ningún mensaje adicional; como cualquier otro cambio, se aplican desde la siguiente fase y el contador de pomodoros no se reinicia. Este cierre es la ruta de salida propia del restablecer, por lo que no entra en conflicto con el descarte silencioso del RF-4.
  *Origen: HU-005 Escenario 3; decisiones 5 y 9.*

- **RF-10:** SI al pulsar Guardar algún campo está vacío, vale cero o está fuera de su rango permitido —estudio 1–60 minutos, descanso corto 1–30 minutos, descanso largo 1–60 minutos, pomodoros 1–10—, ENTONCES EL SISTEMA no guarda ningún cambio del formulario e indica bajo ese campo, sin recurrir a un diálogo, qué valores puede usar.
  *Origen: HU-005 Escenario 2; decisiones 1, 2 y 7.*

- **RF-11:** EL SISTEMA muestra siempre, debajo de cada campo, el rango de valores que ese campo admite, antes de que el usuario se equivoque.
  *Origen: decisión 7.*

- **RF-12:** CUANDO el usuario edita un campo de ajuste, EL SISTEMA presenta un teclado numérico y solo admite números enteros: sin decimales, sin negativos y sin vacíos como tiempo válido.
  *Origen: decisiones previas del preámbulo de decisiones.md (skills rn-conventions y pomodoro-rules); decisión 1.*

- **RF-13:** MIENTRAS el teclado esté desplegado, EL SISTEMA mantiene el botón Guardar a la vista para poder pulsarlo sin tener que cerrar el teclado.
  *Origen: decisiones previas del preámbulo de decisiones.md (skill rn-conventions).*

## Requisitos no funcionales

- **RNF-1:** Ajustes funciona sin conexión a internet. *Origen: constitución (principio 1).*

- **RNF-2:** Los tiempos ajustados y el estado de la sesión se conservan solo en el dispositivo; la aplicación no pide cuenta ni registro para usarlos. *Origen: constitución (principio 5).*

- **RNF-3:** La pantalla de ajustes y sus mensajes usan la identidad visual de la Academia Cotopaxi, incluidos los errores de validación. *Origen: constitución (principio 7); decisión 7.*

- **RNF-4:** Usar ajustes no altera la exactitud del conteo: el temporizador sigue midiendo rigurosamente mientras el usuario está en esa pantalla. *Origen: constitución (principio 6); decisión 3.*

## Casos límite

- Guardar un cambio con la fase corriendo o en pausa: la fase termina con la duración con la que empezó y el cambio se nota a partir de la siguiente (HU-005 Escenario 4; decisión 6).
- Guardar un cambio con la fase mostrada todavía sin iniciar: esa fase toma el valor nuevo (decisión 6).
- Cambiar la cantidad de pomodoros con el contador igual o superior al valor nuevo: al terminar la fase de estudio en curso se pasa al descanso largo; con un contador menor, la cuenta sigue hacia él (decisión 4).
- El contador de pomodoros nunca se reinicia por guardar un cambio ni por restablecer (decisiones 4 y 5).
- Salir de ajustes sin pulsar Guardar: todo lo escrito se descarta en silencio (decisión 2).
- Pulsar Guardar con un campo inválido: no se guarda nada del formulario completo (decisión 2).
- Restablecer con una sesión en marcha: no corta la fase en curso; la confirmación en el diálogo persiste los valores por defecto y cierra ajustes sin pasar por Guardar (decisiones 5 y 9).
- Escribir valores con decimales o negativos: no se admiten (preámbulo de decisiones.md; decisión 1).
- Estar en ajustes cuando una fase llega a cero: el temporizador sigue funcionando, así que el fin de fase ocurre igual que con la app en la pantalla principal (decisión 3; avisos definidos en la spec 004).

## Fuera de alcance

- Cualquier ajuste distinto de los cuatro de la historia (sonidos, avisos, apariencia).
- Pausar, reiniciar o saltar de fase desde la pantalla de ajustes: entrar a ajustes no controla el temporizador (decisión 3).
- Cambiar de forma permanente los valores por defecto de la técnica: restablecer solo los devuelve (HU-005 Escenario 3).
- Copiar los ajustes a otro dispositivo o respaldarlos fuera del teléfono (constitución 5).
- Estadísticas o historial de sesiones.

## Criterios de finalización

- Los cuatro escenarios de HU-005 verificados con la lista manual de la tarea en Expo Go.
- La lógica de rangos, validación, guardado, descarte, aplicación de cambios y revalidación del contador pasa las pruebas automatizadas en verde (constitución 4).
- RNF-1 y RNF-2 comprobados: ajustes sin conexión y sin pedir cuenta.

## Dudas abiertas

- Ninguna: las cuatro preguntas de la HU quedan cubiertas por los RF y las nueve decisiones (las ocho de la entrevista más la decisión 9, resuelta en la revisión QA); todos los puntos previos están aplicados y no hay decisiones revocadas por una posterior.
