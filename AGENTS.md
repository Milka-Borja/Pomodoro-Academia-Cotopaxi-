# AGENTS.md — Temporizador Pomodoro Academia Cotopaxi

App móvil para estudiantes de la Academia Cotopaxi: permite gestionar sesiones de estudio utilizando la técnica Pomodoro. Incluye temporizador con funcionamiento en segundo plano, notificaciones, y no requiere conexión a internet, registro ni contiene publicidad. Proyecto académico.

## Stack y estructura
- Expo (plantilla por defecto de create-expo-app), TypeScript y Expo Router.
- Persistencia local con `@react-native-async-storage/async-storage`. Sin backend ni cuentas.
- Manejo de notificaciones en segundo plano (ej. `expo-notifications`, `expo-task-manager`).
- `src/domain/`: lógica pura de los ciclos Pomodoro (sin React ni AsyncStorage). `src/storage/`: persistencia. `app/`: pantallas. Pruebas junto a cada módulo, en `__tests__/`.

## Comandos
- Ejecutar: `npx expo start` (si la red bloquea: `npx expo start --tunnel`)
- Pruebas: `npx jest`
- Tipos: `npx tsc --noEmit`

## Convenciones
- Código y nombres en inglés; textos de interfaz y comentarios en español.
- Las reglas de negocio del Pomodoro (tiempos por defecto: 25 min estudio, 5 min descanso corto, 15 min descanso largo) están en la skill `pomodoro-rules`. Las decisiones de cómo representarlas y validarlas se toman en la spec de cada historia (`specs/NNN-*/decisiones.md`), no se improvisan.
- Colores y contraste: skill `cotopaxi-brand` (debe ser intuitiva y usar los colores de la Academia Cotopaxi). Trampas de interfaz: `rn-conventions`.

## Forma de trabajar
- Lee `docs/constitution.md` y la spec activa (`specs/NNN-*/`) antes de tocar código.
- Antes de escribir código muestra el plan. Una tarea por vez.
- Si tienes dudas, pregunta antes de asumir.

# Comandos y Skills SDD (IMPORTANTE PARA EL AGENTE)
El sistema utiliza la metodología SDD. Tienes disponibles los siguientes comandos personalizados. Cuando el usuario escriba uno de estos comandos, DEBES leer el archivo correspondiente en la carpeta `.opencode/commands/` y ejecutar sus instrucciones al pie de la letra:

- `/sdd-clarify` -> Lee `.opencode/commands/sdd-clarify.md`
- `/sdd-plan` -> Lee `.opencode/commands/sdd-plan.md`
- `/sdd-tasks` -> Lee `.opencode/commands/sdd-tasks.md`
- `/sdd-implement` -> Lee `.opencode/commands/sdd-implement.md`
- `/sdd-validate` -> Lee `.opencode/commands/sdd-validate.md`
- `/sdd-change` -> Lee `.opencode/commands/sdd-change.md`
- `/sdd-status` -> Lee `.opencode/commands/sdd-status.md`
- `/sdd-spec` -> Lee `.opencode/commands/sdd-spec.md`

Eres capaz de usar estos comandos en cualquier momento. No digas que no tienes la skill instalada; tu comportamiento SDD está definido en esos archivos.
## Límites
- Siempre: pruebas primero en la lógica y textos en español.
- Pregunta antes: instalar dependencias, crear archivos fuera del plan, cambiar el formato de los datos guardados.
- Nunca: reemplazar archivos existentes sin que la tarea lo pida, ni guardar datos sensibles.

## Memoria
- Al empezar lee `MEMORY.md`. Al terminar cada fase de SDD o cada tarea, actualiza solo "Estado actual" y "Próximos pasos" (con el siguiente comando `/sdd-*` a ejecutar).
- No copies decisiones ni contenido de las specs en `MEMORY.md`: remite al archivo (`specs/NNN-*/decisiones.md`). Sin detalles de implementación.
- Máximo ~50 líneas; si lo superas, resúmelo.

## Verificación
- Lógica: `npx jest` en verde. Interfaz: la lista manual de la tarea en Expo Go.

