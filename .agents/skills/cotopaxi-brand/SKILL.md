---
name: cotopaxi-brand
description: Úsala siempre que diseñes, estilices, propongas o revises componentes de interfaz (UI) para la aplicación Pomodoro de la Academia Cotopaxi. Define la paleta estricta, las reglas de accesibilidad y las prohibiciones visuales.
---

# Identidad Visual y Accesibilidad — Academia Cotopaxi

## 1. Paleta de Colores Oficial
Los únicos colores base permitidos para la construcción de la interfaz son los extraídos de la identidad de la institución:

* **Azul Marino Cotopaxi (`#1B1D5D`):** Color primario. Transmite formalidad y concentración.
* **Dorado Cotopaxi (`#C89B1E`):** Color secundario/acento. Transmite energía y recompensa.
* **Blanco Nieve (`#FFFFFF`):** Color de fondo principal.
* **Grises neutros (derivados claros):** Permitidos únicamente para bordes sutiles, sombras o estados deshabilitados, siempre y cuando no comprometan el contraste.

## 2. Reglas Estrictas de Diseño (Lo que SIEMPRE se debe hacer)

* **Jerarquía visual:** El Azul Marino debe dominar las acciones principales (botones de "Iniciar", barra de navegación, textos de lectura principal).
* **Uso del Dorado:** Debe reservarse para acentos, iconos de estado (ej. para indicar que el usuario está en "Descanso"), o botones de acciones secundarias.
* **Fondos:** El fondo principal de la aplicación debe ser Blanco o un gris extremadamente claro para evitar la fatiga visual durante las sesiones de estudio.
* **Contraste WCAG AA:** Todo texto normal debe tener una relación de contraste mínima de 4.5:1 respecto a su fondo. Todo texto grande o componente gráfico esencial debe tener mínimo 3.0:1.
* **Tipografía:** Usar fuentes sin serifas (sans-serif), legibles y de tamaño adecuado para evitar forzar la vista de los estudiantes.

## 3. Prohibiciones (Lo que NUNCA se debe hacer)

* **PROHIBIDO usar Dorado sobre Blanco para textos:** El contraste es insuficiente e ilegible. Si necesitas usar Dorado en un fondo claro, debe ser solo para iconos gruesos o bordes, nunca para información vital o texto.
* **PROHIBIDO el uso de colores de alerta genéricos puros:** No uses rojos (`#FF0000`) brillantes o verdes neón que rompan la paleta formal. Si necesitas mostrar un error o una advertencia, usa tonos oscuros o derivaciones sobrias que armonicen con el Azul Marino.
* **PROHIBIDO el modo oscuro forzado:** A menos que una historia de usuario lo exija explícitamente, la app debe mantener la limpieza del fondo blanco. No improvisar un modo oscuro que distorsione los colores institucionales.
* **PROHIBIDO sobrecargar la interfaz:** Cero gradientes complejos, sombras exageradas o animaciones innecesarias que distraigan al estudiante de su objetivo (concentración).
* **PROHIBIDO improvisar colores:** Cualquier nuevo color necesario para la interfaz debe ser una variación de luminosidad/opacidad del Azul Marino o el Dorado, nunca un tono completamente nuevo sacado al azar.

## 4. Revisión de Accesibilidad Continua
Al proponer la estructura de una pantalla o un componente de React Native (como los estilos en `StyleSheet`), el agente debe verificar lógicamente que las combinaciones propuestas cumplan la regla de contraste (ej. Texto Blanco sobre botón Azul Marino es correcto; Texto Gris medio sobre fondo Azul Marino es incorrecto).