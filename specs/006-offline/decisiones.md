# Decisiones — HU-006: Usar la aplicación sin registro, sin internet y sin publicidad

Preguntas de la entrevista de clarificación, en orden. Cada decisión registra la
pregunta, la respuesta del usuario y el motivo.

Ya resuelto antes de entrevistar (no se pregunta): sin cuenta y sin registro ya
lo impone la constitución (principio 5: la app jamás pide crear una cuenta), el
almacenamiento local con `@react-native-async-storage/async-storage` ya está
elegido y probado en las specs 001–005, y los valores por defecto de la primera
apertura (25/5/15/4) los fija la skill `pomodoro-rules` vía la spec 005.

## 1. Cómo se garantiza el "sin internet"

**Pregunta:** La historia exige que "todo funciona igual" sin datos móviles ni
wifi, pero no dice cómo se garantiza que la app nunca se conecte. ¿Nivel de
garantía: por código y pruebas, eliminando el permiso `INTERNET`, o solo
revisión manual?

**Respuesta:** Por código + pruebas: ninguna ruta hace peticiones de red; se
verifica con Jest (tests que fallan si aparece `fetch`/XHR donde no debe) y con
la lista manual en modo avión. El permiso `INTERNET` del manifiesto queda, porque
lo usan Expo Go y Metro en desarrollo.

**Motivo:** Es el nivel que cumple el principio 1 de la constitución (cero
conexiones innecesarias) sin tocar el manifiesto: quitar el permiso añadiría un
config plugin —una dependencia y un punto de fallo nuevos— y podría romper
herramientas de desarrollo y el propio parche de `metro.config.js` que la spec
003 documentó. Un test que falla si aparece red es la red de seguridad que la
revisión manual no da, y el modo avión manual cubre el resto.

## 2. Primer arranque: los modales de permisos de la spec 004

**Pregunta:** El Escenario 1 dice que al abrir la app por primera vez llego
"directo al temporizador, sin pantallas de registro". Pero la spec 004 ya muestra
en el primer arranque el modal de explicación de notificaciones y la invitación a
"Alarmas y recordatorios". ¿Son compatibles con "llego directo al temporizador"?

**Respuesta:** Se aceptan como están: los modales de permisos no son pantallas
de registro ni de inicio de sesión, no piden datos personales y ninguna acción
los bloquea (RF-14: todas las rutas terminan arrancando el temporizador). La
HU-006 se cumple: el estudiante llega al temporizador sin registrarse.

**Motivo:** "Sin registro" y "sin permisos" son promesas distintas. La historia
prohíbe crear una cuenta, no pedir permisos del sistema, y la constitución exige
los avisos de la spec 004 (exactitud del tiempo, principio 6). Reordenar la
cadena de arranque de 004 sería un cambio de comportamiento ya validado y
verificado en Expo Go sin que esta historia lo pida. Además, ningún modal
detiene el reloj: el estudiante estudia desde el primer toque.

## 3. Pérdida de los datos al desinstalar o cambiar de teléfono

**Pregunta:** El Escenario 2 dice "mis ajustes quedan guardados en el celular",
pero AsyncStorage se borra al desinstalar la app. ¿Qué pasa con los datos si
desinstala o cambia de teléfono?

**Respuesta:** Se acepta la pérdida: la promesa es guardado local, no respaldo.
Desinstalar borra todo; volver a instalar empieza con los valores por defecto
(25/5/15/4). Sin exportar, sin copia en la nube.

**Motivo:** Exportar/importar añadiría una pantalla, lógica de archivos y pruebas
nuevas para un caso que la historia ni plantea, y una copia en la nube
contradecería frontalmente el principio 5 (datos estrictamente locales) y el
propósito offline de esta HU. El "guardado en el celular" del escenario se
cumple literalmente mientras la app esté instalada, que es lo que el estudiante
vive.

## 4. Cómo se verifica el escenario "usarla sin conexión"

**Pregunta:** El Escenario 2 exige evidencia, pero en desarrollo Expo Go carga el
bundle por la red de Metro. ¿Cómo verificamos que "todo funciona igual sin datos
móviles ni wifi"?

**Respuesta:** Modo avión en Expo Go: cargar la app con Metro y después poner
modo avión; se recorren temporizador, avisos y ajustes. Queda documentada la
salvedad: en desarrollo el bundle sí se sirve por red, así que el "primer
arranque real sin internet" solo se cumple en un build de producción. Mismo
criterio que la salvedad de development build aceptada en la spec 003.

**Motivo:** Es la evidencia más fuerte posible hoy sin instalar nada nuevo: el
bundle ya cargado corre entero sin red, que es exactamente lo que promete la
historia. Esperar a un development build retrasaría el cierre de la historia sin
aportar nada al alcance (el offline es lógica de la app, no de la plataforma), y
la salvedad ya tiene precedente aprobado en 003, así que no se descubre nada
nuevo.

## 5. Indicador de "sin conexión" en la interfaz

**Pregunta:** El Escenario 2 dice "todo funciona igual" sin conexión, pero no dice
si la app debe mostrar o esconder ese estado. ¿Quieres algún indicador de "sin
conexión" en la interfaz?

**Respuesta:** Ningún indicador: nada cambia visible. Si el estudiante activa el
modo avión, la app se comporta idéntica y no se le avisa de nada.

**Motivo:** Es la lectura literal de "todo funciona igual": un indicador diría
"esto es excepcional" cuando la normalidad de la app es funcionar sin red. Y un
estado visual nuevo se integraría con la identidad Cotopaxi y tendría que
probarse en dos situaciones (con y sin red) para una historia que no lo pide.
Un estado menos es un estado menos que mantener.

## 6. Alcance de "cero anuncios"

**Pregunta:** El Escenario 3 solo dice "no aparece ningún anuncio". ¿Hasta dónde
llega la promesa de "sin publicidad"? ¿También analíticas, crash reporting,
telemetría y assets remotos?

**Respuesta:** Cero SDKs y assets locales: ningún SDK de anuncios, analítica, crash
reporting ni telemetría; todos los assets (iconos, fuentes) van empaquetados en la
app, sin URLs remotas. Verificación: revisión de `package.json` y de llamadas HTTP
en el código, documentada en la lista manual.

**Motivo:** Un SDK de analítica o crash reporting es, a ojos del estudiante,
idéntico a un anuncio: habla con servidores que él no eligió y lo hace sin que la
app se lo pida. Prohibirlos de antemano es la aplicación directa del principio 1
(cero conexiones innecesarias) y evita que la discusión se reabra cuando alguien
proponga "solo un poco de telemetría". Los assets remotos fuera porque una imagen
o fuente cargada de una URL rompería el offline por la puerta trasera.

## 7. Datos guardados ilegibles o fallidos al abrir

**Pregunta:** El Escenario 2 promete "mis ajustes quedan guardados en el celular",
pero AsyncStorage puede fallar o devolver datos corruptos (versión vieja,
almacenamiento lleno). ¿Qué debe pasar si al abrir la app no se pueden leer los
datos guardados?

**Respuesta:** Volver a defaults en silencio: si la lectura falla o los datos no
se interpretan, la app descarta lo ilegible, aplica los valores por defecto
(25/5/15/4) y sigue funcionando. Sin diálogo, sin bloqueo.

**Motivo:** El estudiante nunca debe quedar fuera de la app por un problema de
almacenamiento: una pantalla de error impediría estudiar, que es el único
propósito del producto. Silencioso para no interrumpir —rn-conventions reserva
los diálogos para acciones críticas del usuario, no para fallos internos— y
porque el efecto colateral (perder la configuración) ya tiene el precedente de la
Decisión 3: los datos locales son valiosos pero prescindibles, y los defaults
siempre devuelven la app a un estado útil.

## 8. Versión del formato guardado y migraciones

**Pregunta:** Última pregunta: la promesa "mis ajustes quedan guardados" abarca
también actualizaciones de la app. ¿Quieres que el almacenamiento lleve ya un
número de versión con migración para el futuro?

**Respuesta:** Sin versionado por ahora: cada spec que cambie lo guardado lo hará
bajo su propia decisión (como ya hicieron 003 y 005). Si una versión futura no
entiende los datos, aplica la Decisión 7 (defaults en silencio).

**Motivo:** Versionar un esquema que aún no tiene segunda versión es complejidad
y pruebas sin caso de uso, contra el principio 1 (simplicidad primero). La red de
seguridad ya existe: la Decisión 7 convierte cualquier dato ininteligible en un
arranque limpio con defaults, así que una actualización con formato nuevo nunca
rompe el arranque. Cuando una spec cambie el formato, decidirá allí si esa vez sí
hace falta migrar —con un motivo concreto— en vez de aquí por adelantado.
