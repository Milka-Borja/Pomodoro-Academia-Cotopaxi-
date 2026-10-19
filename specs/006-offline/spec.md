# Spec 006 — Usar la aplicación sin registro, sin internet y sin publicidad

Estado: completada (T1–T5 completas; verificación manual de Expo Go confirmada por el usuario, 2026-10-19)
HU de origen: docs/historias/HU-006.md (HU-006: Usar la aplicación sin registro, sin internet y sin publicidad)

## Contexto y objetivo

La promesa del producto es empezar a estudiar sin trabas: el estudiante instala la aplicación y la usa de inmediato, sin crear una cuenta, sin datos móviles ni wifi y sin anuncios. Las specs 001–005 ya construyen el temporizador, los avisos y los ajustes; esta spec fija qué garantiza esa promesa en conjunto —primer arranque, funcionamiento sin conexión, guardado local y ausencia total de publicidad y de servicios externos— y con qué se comprueba, para que nadie pueda reabrir la discusión por un atajo (un indicador, una copia en la nube, "solo un poco de telemetría").

## Usuarios

- Estudiante que quiere estudiar nada más instalar la app, sin registrarse y sin depender de la red.

## Historias de usuario

- HU-006: Usar la aplicación sin registro, sin internet y sin publicidad (docs/historias/HU-006.md). Escenarios: abrir la aplicación por primera vez; usarla sin conexión; usarla sin publicidad.

## Definiciones

- "Sin registro": no se pide nunca crear una cuenta ni facilitar datos personales para usar la aplicación.
- "Sin conexión": sin datos móviles ni wifi (dispositivo en modo avión).
- "Ajustes guardados en el celular": los cambios sobreviven a cerrar y reabrir la aplicación mientras esta siga instalada; no implica respaldo ni copia en otro lugar.
- "Valores por defecto": los de la técnica al primer arranque —25 minutos de estudio, 5 de descanso corto, 15 de descanso largo y 4 pomodoros por ciclo—.
- "Aviso de permiso": los diálogos del primer arranque de la spec 004 (explicación de notificaciones e invitación a «Alarmas y recordatorios»); no son pantallas de registro.
- "Anuncio": contenido promocional de terceros; la promesa "sin publicidad" alcanza también SDKs de analítica, crash reporting y telemetría, que hablan con servidores sin que el estudiante lo pida (decisión 6).

## Requisitos funcionales

- **RF-1:** CUANDO el usuario abre la aplicación por primera vez, EL SISTEMA lo lleva directo al temporizador, sin pantallas de registro ni de inicio de sesión.
  *Origen: HU-006 Escenario 1.*

- **RF-2:** EL SISTEMA no pide en ningún momento crear una cuenta ni registrarse para usarlo.
  *Origen: constitución (principio 5); HU-006 Escenario 1.*

- **RF-3:** CUANDO en el primer arranque la aplicación muestre los avisos de permisos, EL SISTEMA los muestra tal como están definidos —sin pedir datos personales— y ninguna acción sobre ellos impide llegar al temporizador.
  *Origen: decisión 2.*

- **RF-4:** CUANDO el usuario use el temporizador, los avisos y los ajustes sin datos móviles ni wifi, EL SISTEMA funciona igual que con conexión.
  *Origen: HU-006 Escenario 2; decisión 4.*

- **RF-5:** EL SISTEMA conserva los ajustes del usuario en el dispositivo mientras la aplicación esté instalada.
  *Origen: HU-006 Escenario 2; decisión 3.*

- **RF-6:** SI el usuario desinstala la aplicación o cambia de teléfono, ENTONCES los datos guardados se pierden y una reinstalación arranca con los valores por defecto, sin exportar y sin ninguna copia fuera del teléfono.
  *Origen: decisión 3.*

- **RF-7:** EL SISTEMA no hace peticiones de red por ninguna ruta de uso.
  *Origen: decisión 1.*

- **RF-8:** MIENTRAS el dispositivo esté sin conexión, EL SISTEMA no muestra ningún indicador de "sin conexión" ni cambia nada visible en la interfaz.
  *Origen: decisión 5.*

- **RF-9:** SI al abrir la aplicación los datos guardados no se pueden leer ni interpretar, ENTONCES EL SISTEMA descarta lo ilegible, aplica los valores por defecto y sigue funcionando, sin diálogo y sin bloquear el uso.
  *Origen: decisiones 7 y 8.*

- **RF-10:** EL SISTEMA no muestra anuncios en ninguna pantalla e incluye cero SDKs de anuncios, analítica, crash reporting ni telemetría.
  *Origen: HU-006 Escenario 3; decisión 6.*

- **RF-11:** EL SISTEMA muestra iconos, fuentes y demás contenidos incluidos con la aplicación sin descargarlos de ninguna URL remota.
  *Origen: decisión 6.*

## Requisitos no funcionales

- **RNF-1:** Toda la aplicación —temporizador, avisos y ajustes— funciona con el dispositivo en modo avión.
  *Origen: constitución (principio 1); HU-006 Escenario 2; decisión 4.*

- **RNF-2:** Cero publicidad y cero conexiones a internet innecesarias: ningún servicio externo habla con servidores por su cuenta.
  *Origen: constitución (principio 1); decisión 6.*

- **RNF-3:** Los datos del usuario se conservan solo en el dispositivo y la aplicación jamás pide crear una cuenta.
  *Origen: constitución (principio 5); decisiones 3 y 6.*

- **RNF-4:** Nada de lo que se ve en la pantalla depende de una descarga por red.
  *Origen: decisión 6; constitución (principio 1).*

## Casos límite

- Primer arranque con los avisos de permisos de la spec 004: se muestran tal cual y todas las rutas terminan arrancando el temporizador; "sin registro" no significa "sin permisos" (decisión 2).
- Desinstalación o cambio de teléfono: se pierde todo y la reinstalación vuelve a los valores por defecto (decisión 3).
- Lectura de los datos guardados fallida o con contenido que no se interpreta: descarte silencioso y valores por defecto (decisión 7).
- Datos guardados por una versión futura de la aplicación que esta no entiende: mismo camino que cualquier dato ilegible, valores por defecto; no hay versionado ni migración por ahora (decisión 8).
- Dispositivo en modo avión: la interfaz no cambia ni se avisa de nada (decisión 5).
- Verificación del "primer arranque sin internet": en desarrollo el bundle se sirve por la red, así que ese primer arranque real sin red solo se cumple en un build de producción; la salvedad queda documentada con el mismo criterio aceptado en la spec 003 (decisión 4).

## Fuera de alcance

- Quitar el permiso de internet del manifiesto: se verifica por código, pruebas y modo avión, no tocándolo (decisión 1).
- Reordenar la cadena de arranque de permisos de la spec 004 (decisión 2).
- Exportar, importar o respaldar los datos en la nube o en otro dispositivo (decisión 3; constitución 5).
- Cualquier indicador o aviso de estado de conexión en la interfaz (decisión 5).
- Versionado del formato guardado y migraciones: cada spec que cambie lo guardado decidirá allí si hace falta (decisión 8).
- Estadísticas, historial o cualquier dato que obligue a hablar con un servidor.

## Criterios de finalización

- Los tres escenarios de HU-006 verificados con la lista manual de la tarea en Expo Go, recorriendo temporizador, avisos y ajustes con el dispositivo en modo avión; salvedad del bundle de desarrollo documentada (decisión 4).
- Pruebas automatizadas en verde que fallen si aparece red donde no debe y que cubran el descarte silencioso de datos ilegibles con vuelta a valores por defecto (constitución 4; decisiones 1 y 7).
- Revisión documentada en la lista manual: sin SDKs de anuncios, analítica, crash reporting ni telemetría y sin URLs remotas en los contenidos (decisión 6).
- `npx jest` y `npx tsc --noEmit` en verde.

## Dudas abiertas

- Ninguna: los tres escenarios de la HU y las ocho decisiones quedan cubiertos por los RF, los RNF y los criterios de finalización; no hay decisiones revocadas por una posterior.
