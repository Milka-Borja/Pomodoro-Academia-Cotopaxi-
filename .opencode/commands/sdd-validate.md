---
description: SDD · Valida la spec RF por RF (pruebas + lista manual)
agent: build
---
Recorre specs/$1/spec.md requisito por requisito. Para cada RF indica qué
prueba lo cubre y el resultado de ejecutar npx jest.

Los RF de interfaz que no se pueden probar con Jest, lístalos como puntos
manuales para que yo los verifique en Expo Go.

Si algún RF no está cubierto o falla, dilo claramente. NO arregles nada
todavía. Después comprueba los criterios de finalización y dame un veredicto:
¿la spec está cumplida?