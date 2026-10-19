---
description: SDD - Redacta la spec desde la HU y decisiones.md (uso - /sdd-spec 001-nombre HU-001)
agent: plan
---
NO escribas código en ningún momento. Lee docs/constitution.md, MEMORY.md, docs/historias/$2.md y specs/$1/decisiones.md, y usa la skill sdd.

Carpeta de la spec: specs/$1/

No me hagas preguntas: las decisiones ya están en decisiones.md. Genera specs/$1/spec.md siguiendo la plantilla de la skill sdd, con los requisitos en EARS y "Estado: borrador".
- Escribe solo specs/$1/spec.md. No modifiques decisiones.md ni MEMORY.md.
- No añadas decisiones. Si algo no está resuelto en decisiones.md ni en la HU, márcalo [NECESITA ACLARACIÓN] y no lo resuelvas tú.
- Ignora las decisiones que otra posterior haya revocado.
- Cada escenario de la HU debe quedar cubierto por al menos un RF.
- Cada RF termina con "Origen:" y el escenario o la decisión de la que sale.
- Un RF por comportamiento visible: no añadas detalles que ningún escenario ni decisión pida.
- Solo el QUÉ y el POR QUÉ: nada de stack, arquitectura, formatos de almacenamiento ni nombres de archivos.