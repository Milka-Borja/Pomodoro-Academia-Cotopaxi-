# Decisiones — HU-005: Ajustar los tiempos del pomodoro

Preguntas de la entrevista de clarificación, en orden. Cada decisión registra la
pregunta, la respuesta del usuario y el motivo.

Ya resuelto antes de entrevistar (no se pregunta): minutos enteros sin
decimales ni negativos y teclado numérico (skill `rn-conventions`), rechazo de
vacío y cero (skill `pomodoro-rules`), botón **Guardar** con el teclado sin
taparlo (skill `rn-conventions`) y restablecer con confirmación `Alert.alert`
(skill `rn-conventions`).

## 1. Rangos permitidos de cada campo

**Pregunta:** El Escenario 2 habla de "valor fuera del rango permitido" y exige
"indicar qué valores puedo usar", pero la historia solo define el mínimo
(nada ≤ 0). ¿Qué rango máximo tiene cada campo?

**Respuesta:** Minutos enteros, mínimo 1 en todos. Estudio 1–60 min, descanso
corto 1–30 min, descanso largo 1–60 min, pomodoros antes del descanso largo
1–10. El mensaje de validación muestra estos límites.

**Motivo:** El escenario obliga a mostrar un rango, y no hay rango sin máximo:
limitar cada campo a su uso real del método (una sesión de estudio rara vez pasa
de una hora; 10 pomodoros ya son más de cuatro horas) evita configuraciones
absurdas que después nadie sabe cómo corregir. El mínimo 1 es lo que ya imponen
las skills: cero o vacío nunca es un tiempo válido, y un ciclo necesita al menos
un pomodoro para existir.

## 2. Guardado: todo o nada y descarte al salir

**Pregunta:** Si toco varios campos y uno es inválido, ¿se guarda solo el
cambio inválido o ninguno? Y si salgo de ajustes sin pulsar Guardar, ¿qué pasa
con lo escrito?

**Respuesta:** Todo o nada: un campo inválido bloquea el Guardar del formulario
completo. Salir sin guardar descarta los cambios en silencio, sin diálogo.

**Motivo:** El Escenario 2 dice "la aplicación no guarda **el cambio**" como un
todo, así que un formulario con un campo inválido no guarda nada: es la lectura
directa de la historia y deja un solo punto de decisión (el Guardar) en lugar de
cuatro independientes que el estudiante no vigila. Descartar al salir sin avisar
es coherente con el propio Escenario 1: lo que sobrevive al cierre de la app es
lo que se guardó con el botón; nada se persiste sin una acción explícita, y un
diálogo de "¿descartar?" añadiría un paso que la historia no pide.

## 3. Entrada a ajustes y efecto sobre el temporizador

**Pregunta:** La pantalla de ajustes no existe hoy (la app solo tiene la
principal). ¿Cómo entra el estudiante y qué ocurre con el temporizador mientras
la usa?

**Respuesta:** Icono de engranaje en la cabecera de la pantalla principal que
abre la ruta de ajustes (Expo Router). El temporizador sigue corriendo igual:
entrar a ajustes no pausa ni reinicia nada.

**Motivo:** La historia da por hecho "estoy en la pantalla de ajustes", así que
crearla y darle un punto de entrada es parte del alcance; un único icono en la
cabecera es la entrada más simple y visible sin inventar una navegación nueva.
Que el reloj siga corriendo es gratis y correcto porque el conteo se basa en
marcas de tiempo absolutas, no en un `setInterval` de la pantalla: pausar al
navegar rompería el principio 6 de la constitución (exactitud del tiempo) y
haría que abrir ajustes fuera un botón oculto de control del temporizador.

## 4. Cambiar la cantidad de pomodoros con el ciclo en curso

**Pregunta:** Con 3 de 4 pomodoros hechos, el estudiante guarda otro valor para
"pomodoros antes del descanso largo". ¿Qué pasa con la cuenta actual?

**Respuesta:** El contador no se toca. Al terminar la fase de estudio en curso
se revalida contra el valor nuevo: si el contador ya alcanza el nuevo valor, toca
descanso largo; si no, sigue contando hacia él.

**Motivo:** Reiniciar el contador tiraría el progreso que el estudiante ya hizo
sin que él lo pidiera, y saltar al descanso largo de inmediato (incluso sin otra
fase de estudio) contradice la regla de `pomodoro-rules` de que el largo llega
al completar un tiempo de estudio. Revalidar al terminar la fase mantiene una
única regla de transición —evaluada con la configuración vigente en ese
momento— así que cambiar el valor a mitad de ciclo produce siempre el mismo
resultado que si se hubiese configurado así desde el inicio.

## 5. Restablecer con el temporizador en curso

**Pregunta:** El Escenario 3 solo dice que los tiempos vuelven a 25/5/15/4.
¿Cuándo se notan esos valores si hay una sesión en marcha y qué más afecta el
"restablecer"?

**Respuesta:** Igual que cualquier otro cambio: la fase actual termina con el
tiempo con el que empezó y los valores por defecto se aplican desde la siguiente
fase. El contador del ciclo de pomodoros no se reinicia.

**Motivo:** Es la misma regla del Escenario 4 aplicada a un cambio de valores
en vez de a un valor escrito a mano, y un solo camino es más fácil de probar y
de explicar: "restablecer" no es un botón mágico que corta la fase en curso.
Que el contador no se reinicie mantiene el "restablecer" en su alcance literal
—los cuatro tiempos por defecto de la historia— y evita que un gesto destinado
a corregir un tiempo destruya también el avance de la sesión.

## 6. Cambiar un tiempo con la fase en pausa o sin iniciar

**Pregunta:** El Escenario 4 habla de "temporizador corriendo". ¿Y si la fase
está en pausa, o es la fase mostrada pero todavía no iniciada?

**Respuesta:** Regla única: toda fase que ya arrancó (corriendo o en pausa)
conserva el tiempo con el que empezó; solo las fases aún no iniciadas toman el
valor nuevo.

**Motivo:** La razón del Escenario 4 —que el cambio no recorte ni alargue sorpresivamente
lo que el estudiante ya está viviendo— aplica igual en pausa: recalcular el
remanente con la duración nueva haría saltar o devolver minutos en un reloj que
debe ser riguroso (principio 6) y rompería la marca de finalización absoluta ya
calculada. Con una sola regla para toda fase iniciada no hay que preguntarse en
qué estado exacto estaba el reloj, y las fases no iniciadas toman el valor nuevo
sin más, porque aún no le deben nada al estudiante.

## 7. Cómo se indica el valor no válido

**Pregunta:** El Escenario 2 exige "me indica qué valores puedo usar", pero no
dice cómo ni cuándo. ¿Texto de ayuda permanente, diálogo o error bajo el campo?

**Respuesta:** Cada campo muestra siempre debajo su rango permitido (ej.
"1–60 min") como texto de ayuda. Si el estudiante pulsa Guardar con un campo
inválido, el error aparece bajo ese campo con los colores de la Academia
Cotopaxi; sin diálogo.

**Motivo:** Mostrar el rango de forma permanente cumple el escenario antes de
que el estudiante se equivoque (prevención > castigo), y además quien ve
"1–60 min" nunca llega a errar. El error bajo el campo apunta exactamente al
problema sin interrumpir con un modal que habría que dismissar para corregir.
Reservar `Alert.alert` para las acciones críticas es la regla de
`rn-conventions`: restablecer lo pide, escribir un número no.

## 8. Qué ocurre en pantalla al pulsar Guardar

**Pregunta:** El Escenario 1 describe el efecto de fondo pero no el de la
interfaz: ¿se queda en ajustes confirmando o vuelve a la pantalla principal?

**Respuesta:** Guardar cierra ajustes y vuelve al temporizador, sin mensaje
adicional.

**Motivo:** El estudiante abre ajustes para cambiar algo y volver a estudiar:
volver solo ya es la confirmación de que la acción terminó, y añadir un mensaje
"Guardado" sería confirmar dos veces algo que ningún escenario pide. Un paso
menos, un estado menos que probar, y la promesa real del Escenario 1 (el nuevo
valor se usa desde la próxima fase y persiste) ya está garantizada por la
persistencia, no por un aviso.

## 9. Restablecer: la confirmación persiste y cierra ajustes

**Pregunta (derivada de la revisión QA de la spec):** Tras confirmar el diálogo
de restablecimiento, ¿hay que pulsar además **Guardar** para que los valores por
defecto queden persistidos, o la confirmación ya los aplica? Si se exigiera
Guardar, salir sin guardar (decisión 2) descartaría un restablecer ya confirmado
y el Escenario 3 de la HU —que no menciona "guardo", a diferencia del Escenario
1— quedaría sin cumplirse.

**Respuesta:** El restablecer es una acción final. Al confirmar el diálogo, el
sistema persiste automáticamente los valores por defecto (25/5/15/4), cierra la
pantalla de ajustes y vuelve al temporizador. No se requiere pulsar Guardar
después de un restablecimiento exitoso.

**Motivo:** Confirmar en el diálogo ya es una acción explícita con su propia
confirmación (preámbulo: restablecer con confirmación `Alert.alert`), así que
pedir además Guardar duplicaría la confirmación y expondría el resultado a que un
cierre accidental lo descartara. Cada camino de salida tiene una sola ruta:
Guardar persiste y cierra los cambios escritos a mano; restablecer confirmado
persiste y cierra los valores por defecto. Así el Escenario 3 se cumple tal como
lo describe la HU: "elijo restablecer y lo confirmo".
