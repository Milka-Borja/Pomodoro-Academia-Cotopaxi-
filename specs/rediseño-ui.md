# Especificación de Rediseño de UI - Estilo Minimalista Dinámico (Fondo Claro)

## 1. Identidad Visual (Inversión de Colores)
- **Fondo General (Background):** Eliminar por completo el Glassmorphism y el fondo azul oscuro de toda la pantalla. Usar un color claro y limpio como base: Gris Claro (`#F4F6F8`) o Blanco Humo (`#F5F5F5`).
- **Tarjetas y Contenedores:** Las tarjetas principales (el reloj Pomodoro y la caja de ajustes) deben ser de color Azul Marino Institucional (`#1B1D5D`). Esto creará un alto contraste y enfocará la vista del estudiante en el reloj.
- **Textos:** Todo el texto dentro de las tarjetas azules (números del reloj, etiquetas) debe ser de color Blanco Puro (`#FFFFFF`) para garantizar la máxima legibilidad. El texto fuera de las tarjetas (como títulos de pantalla) debe ser Azul Marino o Gris Oscuro.
- **Acentos:** Utilizar el Dorado Institucional (`#C89B1E`) para resaltar los elementos interactivos o de progreso: el botón de acción principal ("Iniciar" / "Pausar"), el botón "Guardar" y los indicadores circulares de progreso.

## 2. Estilo de Componentes (Flat Moderno)
- **Sombras Sutiles (Elevación):** Las tarjetas azules deben tener una ligera sombra paralela (Drop Shadow) para dar la sensación de que "flotan" sobre el fondo claro.
  - Ejemplo: `shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5`.
- **Bordes:** Las tarjetas y botones deben tener bordes redondeados (ej. `borderRadius: 20` o `24`) para una apariencia amigable y moderna. Eliminar cualquier línea de borde (`borderWidth: 0`).
- **Botones:** Los botones deben ser sólidos y con forma de píldora (bordes completamente redondeados). El botón principal será Dorado con texto Blanco. Los botones secundarios (como "Reiniciar" o "Restablecer") pueden tener un fondo semi-transparente o un color azul más claro para no competir visualmente con la acción principal.

## 3. Elementos Visuales Adicionales
- **Ícono Cabecera:** En la pantalla principal, en la parte superior izquierda, mantener un ícono representativo minimalista usando `@expo/vector-icons` (ej. una montaña o `<FontAwesome5 name="school" />`). Como el fondo general ahora es claro, este ícono debe ser de color Azul Marino (`#1B1D5D`) o Dorado (`#C89B1E`).
- **Textura de Fondo (Opcional pero Recomendado):** Para evitar que el fondo claro se vea muy vacío, añadir un patrón de textura muy sutil en toda la pantalla base (como un granulado fino o puntos muy separados al 3% de opacidad). Esto le da un aspecto de "cuaderno" de estudio.

## 4. Instrucción Estricta para el Agente:
1. Elimina del proyecto las dependencias de `expo-blur` y `expo-linear-gradient` y limpia cualquier código relacionado con ellas.
2. Refactoriza todos los componentes de la interfaz de la aplicación (Principal y Ajustes) para cumplir exactamente con este nuevo diseño de "tarjeta azul sobre fondo claro", asegurando que la identidad de la Academia Cotopaxi se mantenga impecable.
3. NO modifiques la lógica del temporizador (Zustand/AsyncStorage), la gestión de notificaciones ni la persistencia de datos (HU-001 a HU-006). Solo altera los estilos y la estructura de las vistas.