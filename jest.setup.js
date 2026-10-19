// Guardia de red global (spec 006, T1; RF-7, RF-4). Se carga vía
// setupFilesAfterEnv en package.json, DESPUÉS del setup del preset de
// jest-expo. NO se redefine setupFiles: el preset empuja su propio setup.js
// dentro de esa clave (ver node_modules/jest-expo/jest-preset.js, L121–125)
// y pisarla rompería todas las suites (decisión técnica 2 del plan).
//
// Cualquier petición de red en cualquier prueba revienta con un error claro:
// la app es offline-first y ninguna ruta de uso puede hablar por red (RF-7).
// Sin lista blanca: el RF-7 es absoluto. Si una dependencia legítima llegara
// a necesitar red en pruebas, eso ya sería un hallazgo que exige revisión,
// no un permiso automático.
//
// La prueba de que estas guardias están activas es T2
// (__tests__/offline.test.ts); esta T1 solo las instala y endosa que las ~11
// suites existentes siguen en verde con la red bloqueada (RF-4).

function prohibirRed(api) {
  throw new Error(
    `Violación offline (spec 006, RF-7): petición de red vía ${api}. ` +
      'La app no debe hacer peticiones de red por ninguna ruta de uso.',
  );
}

global.fetch = function fetchProhibido() {
  prohibirRed('fetch');
};

global.XMLHttpRequest = class XMLHttpRequestProhibido {
  constructor() {
    prohibirRed('XMLHttpRequest');
  }
};

global.WebSocket = class WebSocketProhibido {
  constructor() {
    prohibirRed('WebSocket');
  }
};
