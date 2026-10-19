# Decisiones — HU-004: Recibir aviso al terminar el tiempo

Preguntas de la entrevista de clarificación, en orden. Cada decisión registra la
pregunta, la respuesta del usuario y el motivo.

## 1. Alarma en silencio: alcance por plataforma

**Pregunta:** La promesa "suena como alarma aunque el celular esté en silencio"
se puede cumplir en Android, pero iOS silencia todo sonido de notificaciones en
modo silencio salvo las critical alerts (que requieren aprobación de Apple y no
están disponibles en Expo Go). ¿Qué hacemos con esa limitación?

**Respuesta:** Android sí suena como alarma real en silencio (stream de alarma);
iOS degrada a vibración + notificación en pantalla de bloqueo, y la limitación
del sistema se documenta como conocida.

**Motivo:** Es la única respuesta honesta dentro del stack autorizado: exigir
sonido en silencio en iOS implicaría salirse de Expo Go y pedir aprobación de
Apple, desproporcionado para un proyecto académico. Renunciar al sonido en
Android (sacrificar la plataforma donde la promesa es posible) sería empeorar la
historia sin necesidad. La degradación en iOS se documenta para que quede claro
que es límite del sistema, no un fallo de la app.

## 2. Aviso en pantalla de bloqueo: encender la pantalla

**Pregunta:** ¿El aviso con el celular bloqueado debe encender la pantalla como
un despertador (full-screen intent) o basta con una notificación normal visible
en la pantalla de bloqueo?

**Respuesta:** Encender la pantalla, estilo despertador, con vista grande y botón
de detener. En iOS no aplica (el sistema restringe esto a apps de alarma).

**Motivo:** El escenario 2 pide "muestra el aviso en la pantalla de bloqueo" con
el celular en silencio: una notificación quieta no cumple el espíritu de "cambiar
de actividad sin estar mirando la pantalla", porque el alumno ni siquiera sabe
que sonó. La vista tipo despertador es lo que convierte el aviso en un
verdadero aviso. La restricción de iOS es del sistema (misma raíz que la
decisión 1) y se documenta igual.

## 3. Aviso con la app abierta en primer plano

**Pregunta:** Cuando el alumno tiene la app abierta mirándola y el tiempo llega a
cero, ¿suena la alarma igual que en background o basta un aviso visual?

**Respuesta:** Alarma completa también con la app abierta: sonido, vibración y
cambio de pantalla a la fase terminada.

**Motivo:** Un solo camino de comportamiento en todas las situaciones es más
simple de implementar, de probar y de explicar al alumno. Que el aviso cambie de
comportamiento según esté abierta o cerrada sería una sorpresa, no una mejora.
Además el alumno puede tener la app abierta y estar distraído (mirando otro
contenido, app en una esquina); el sonido es justamente el canal que no depende
de que esté mirando.

## 4. Alarma ignorada: suena un rato y para sola

**Pregunta:** Si el alumno nunca toca la notificación ni el botón de detener,
¿qué hace la alarma?

**Respuesta:** Suena un tiempo limitado y para sola; la notificación permanece en
la bandeja hasta que él la atienda.

**Motivo:** Repetir hasta que la detenga sería hostil: un alumno ausente
acumularía una alarma infinita en el bolsillo, y el método Pomodoro no contempla
snooze. Una ráfaga demasiado corta arriesga no cumplir el escenario 1 ("recibo
una notificación con sonido y vibración"). El punto medio (ráfaga razonable y
parada sola) avisa sin castigar, y la notificación persistente garantiza que la
información no se pierda aunque el sonido haya terminado.

## 5. Permiso: explicar y solicitar al iniciar por primera vez

**Pregunta:** ¿Cuándo y cómo se explica y solicita el permiso de notificaciones, y
qué ocurre si el alumno lo rechaza?

**Respuesta:** Al tocar Iniciar por primera vez: la app muestra su propia
explicación de por qué necesita el permiso y, al continuar, se dispara el
diálogo del sistema. Si rechaza, se degrada como en la decisión 4 de 003 (sin
avisos, sin insistir).

**Motivo:** El escenario 4 pide explícitamente "al iniciar un temporizador por
primera vez", así que ese es el momento. Pedirlo en el primer arranque de la app
sería antes de que el alumno entienda para qué lo quiere; insistir en cada inicio
sería ruidoso y violaría el límite de AGENTS.md de no insistir con diálogos
repetidos. Reusar la degradación ya decidida en 003 evita contradicciones entre
historias: el permiso se pide una vez con contexto, y la app sigue siendo útil
sin él.

## 6. Botón de detener solo en la vista de alarma

**Pregunta:** El escenario "Detener el aviso" menciona "toco la notificación o el
botón de detener". ¿Dónde debe estar el botón de detener?

**Respuesta:** Botón grande de detener solo en la vista de alarma (la que enciende
la pantalla). Tocar la notificación de bandeja simplemente abre la app, la cual
al abrirse detiene el aviso y muestra la siguiente fase.

**Motivo:** Un solo mecanismo de parada dedicado es más simple y evita la
ambigüedad de dos caminos que detienen desde fuera. La notificación de bandeja ya
tiene su comportamiento definido en la decisión 6 de 003 (abre el temporizador),
y abrir la app detiene el aviso de forma natural, así que ambos caminos del
escenario quedan cubiertos sin duplicar botones.

## 7. Reposo del celular y optimización de batería: best effort

**Pregunta:** Con el celular en reposo prolongado (Doze) u optimización de
batería agresiva, ¿cuánta fiabilidad exigimos al aviso?

**Respuesta:** Best effort con los mecanismos normales de notificación
programada. Si el sistema retrasa el aviso en Doze extremo, se documenta como
limitación conocida. Sin pedir cambios de configuración al alumno y sin permiso
de alarmas exactas.

**Motivo:** Pedirle al alumno que desactive la optimización de batería sería
hostil para un proyecto académico y añadiría un paso de soporte que la historia
no pide. El permiso de alarmas exactas añade complejidad de plataforma para un
margen de mejora mínimo en el caso menos frecuente. La promesa central (avisar
al terminar) se cumple en el escenario normal de uso; documentar la excepción
extrema respeta el principio de simplicidad primero y es coherente con cómo se
trató el reinicio en la decisión 7 de 003.

## 8. Sonido de la alarma: por defecto del sistema

**Pregunta:** ¿Qué sonido usa la alarma: el tono de alarma por defecto del
sistema o un tono propio incluido en la app?

**Respuesta:** Sonido de alarma por defecto del sistema, configurado en el canal
de notificación de tipo alarma. Sin archivos de audio nuevos.

**Motivo:** Cero assets nuevos y máxima compatibilidad con Expo Go y con los
fabricantes de Android, que suelen tener tonos de alarma distintos. Un tono
personalizado añade un archivo que verificar por plataforma y es exactamente el
tipo de complejidad que la constitución pide evitar cuando no aporta a la
historia: el alumno necesita saber qué fase terminó, no reconocer una marca
sonora. La identidad visual Cotopaxi se aplica a la interfaz (decisión 7 de la
constitución), no al sonido del sistema.

## 9. Duración de la ráfaga de alarma ignorada

**Pregunta:** La decisión 4 fija que, si el alumno no atiende el aviso, la alarma
suena un tiempo limitado y para sola. ¿Cuánto tiempo suena antes de pararse sola?

**Respuesta:** Unos 30 segundos y para sola; la notificación permanece en la
bandeja hasta que el alumno la atienda.

**Motivo:** Es el punto medio entre los dos riesgos que la decisión 4 ya pesó:
una ráfaga demasiado corta arriesga no cumplir el Escenario 1 ("recibo una
notificación con sonido y vibración") y sonar hasta que la detenga sería hostil
para el alumno ausente. Treinta segundos dan margen para quien está cerca pero
no mirando la pantalla, sin acumular una alarma insistente en el bolsillo, y la
notificación persistente garantiza que la información no se pierda cuando el
sonido ya terminó.

## 10. Qué muestra la app al abrirse desde el aviso

**Pregunta:** El Escenario 3 de HU-004 y la decisión 6 dicen "muestra la
siguiente fase", pero la decisión 2 de la spec 003 dice que la fase aparece
terminada y que el alumno decide cuándo iniciar la siguiente. ¿La siguiente
fase aparece lista para iniciar, inicia automáticamente o se muestra primero la
fase terminada?

**Respuesta:** Se muestra primero la fase terminada, con el botón para iniciar
la siguiente; la siguiente fase no arranca sola.

**Motivo:** Es la lectura que ya sostienen las decisiones 2 y 6 de la spec 003,
ya cableada y verificada: el avance de fase solo ocurre por acción explícita,
así que abrir la app para mirar la notificación nunca gasta un descanso. El
Escenario 3 queda cumplido en el sentido de "mostrando cuál es la que sigue",
el alumno ve qué fase cumplió y cuál viene antes de decidir, y el coste de un
toque más es menor que el riesgo de consumir fases sin querer.

## 11. Alarmas exactas: invitación única por código (cambio 1)

**Pregunta (observación 1 de la validación de 004):** El diagnóstico de T8 mostró
que el aviso solo llega a la hora exacta con «Alarmas y recordatorios» activo, y
el estudiante tuvo que activarlo a mano en los ajustes del celular — algo que
RNF-3 decía que no se exige. ¿Solicitamos ese permiso por código?

**Respuesta:** Sí: con notificaciones concedidas y en Android 12 o superior, la
app muestra una explicación propia —una sola vez por instalación— con dos
opciones: abrir la pantalla del sistema de «Alarmas y recordatorios» o continuar
sin activarlo. Cualquiera de las dos arranca el temporizador (RNF-3 reescrita:
nada bloquea la app); quien lo omita sigue en mejor esfuerzo y la app informa una
sola vez sin volver a invitar. La decisión 7 queda anulada en su parte de «sin
solicitar alarmas exactas»; la optimización de batería sigue fuera de alcance.

**Motivo:** La validación comprobó en dispositivo que sin ese permiso el aviso no
es puntual y en primer plano a veces ni llega, con lo que la promesa central de
HU-004 se cae en el caso real. Pedirlo por código es la corrección más barata que
la cumple sin exigirle al estudiante que explore los ajustes a ciegas: se usa la
pantalla del sistema con `Linking.sendIntent` (integrado en React Native, cero
dependencias nuevas, principio 1) y un único punto de información (AGENTS.md: no
insistir con diálogos repetidos). Como el SDK 57 no expone
`canScheduleExactAlarms()` a JavaScript, no es posible saber si ya está concedido,
y por eso la invitación es única por instalación y su texto cubre el caso «ya
estaba activado» (caso límite de la spec). La degradación al no activarlo
conserva el mejor esfuerzo que la decisión 7 ya había aceptado, ahora
condicionado por esta.
