---
name: rn-conventions
description: Úsala siempre que crees, modifiques o revises pantallas, formularios o componentes de interfaz del Temporizador Pomodoro de la Academia Cotopaxi.
---

# Convenciones de interfaz en React Native

## Reglas
- Estilos estrictamente con `StyleSheet`. Sin librerías de componentes UI adicionales (ej. NativeBase, UI Kitten) para mantener la app ligera e independiente.
- Campos de tiempo en ajustes: usar teclado numérico (`keyboardType="numeric"`). Se deben bloquear ingresos de caracteres no numéricos, decimales o negativos.
- Los formularios no deben quedar tapados por el teclado. Usa un contenedor que se desplace (`KeyboardAvoidingView` o `ScrollView`) y permite tocar botones con el teclado abierto.
- Respeta las áreas seguras del dispositivo (muesca y barras del sistema) usando `SafeAreaView`.
- Etiquetas de accesibilidad (`accessibilityLabel`) obligatorias en botones (Iniciar, Pausar, Reiniciar) y cualquier icono interactivo.
- Acciones críticas: reiniciar un temporizador en curso o restablecer los ajustes por defecto siempre debe pedir confirmación con un diálogo nativo del sistema (`Alert.alert`).
- Todos los textos visibles en la interfaz deben estar en español.
- Tipografía del temporizador: usar variantes de fuente monoespaciadas (o `fontVariant: ['tabular-nums']`) para que el texto no "salte" visualmente cuando los segundos cambian (ej. del 1 al 0).

## Lista manual de verificación en Expo Go
- [ ] Se ve bien en vertical y los elementos no se desbordan en pantallas pequeñas.
- [ ] El teclado no tapa el campo de texto ni el botón de guardar en la pantalla de ajustes.
- [ ] La configuración de tiempo no permite guardar valores en cero o vacíos.
- [ ] Cerrar la app por completo y abrirla conserva los tiempos personalizados y el estado de la sesión.
- [ ] Los textos y el reloj se leen perfectamente, respetando los contrastes de la skill `cotopaxi-brand`.