// Autotest de la guardia de red (spec 006, T2; RF-7) y garantías estáticas
// (spec 006, T3; RF-10, RF-11). Raíz junto a jest.setup.js y package.json,
// que es lo que custodia: si alguien borra o rompe `setupFilesAfterEnv` en
// package.json, las pruebas de la guardia revientan y delatan la guardia
// ausente (verificado por mutación en el cierre de T2); y si aparece un SDK
// prohibido o una URL remota, las garantías estáticas de T3 fallan.
//
// Las tres APIs de red que la app NO debe usar nunca deben lanzar el error
// «Violación offline (spec 006, RF-7)…» de jest.setup.js. Sin excepciones ni
// lista blanca: el RF-7 es absoluto (decisión 1 de la spec).

import * as fs from 'fs';
import * as path from 'path';

const raiz = path.resolve(__dirname, '..');

describe('guardia de red global (jest.setup.js)', () => {
  it('fetch lanza el error de la guardia al usarse', () => {
    expect(() => global.fetch('https://ejemplo.invalid')).toThrow(
      /Violación offline \(spec 006, RF-7\).*fetch/,
    );
  });

  it('XMLHttpRequest lanza el error de la guardia al instanciarse', () => {
    expect(() => new XMLHttpRequest()).toThrow(
      /Violación offline \(spec 006, RF-7\).*XMLHttpRequest/,
    );
  });

  it('WebSocket lanza el error de la guardia al instanciarse', () => {
    expect(() => new WebSocket('wss://ejemplo.invalid')).toThrow(
      /Violación offline \(spec 006, RF-7\).*WebSocket/,
    );
  });
});

// RF-10 (decisión 6): cero SDKs de anuncios, analítica, crash reporting ni
// telemetría. Se escanean las `dependencies` — lo único que se empaqueta en la
// app—; las `devDependencies` son herramientas de build/prueba que nunca
// viajan en el bundle ni hablan en runtime. Patrones por categoría:
// anuncios (admob, applovin…), analítica/telemetría (analytics, amplitude,
// mixpanel, telemetry, appsflyer, segment, datadog…), crash reporting
// (sentry, bugsnag, crashlytics, appcenter…) y servicios que hablan con
// servidores ajenos (firebase, facebook, google-analytics).
const PATRONES_PROHIBIDOS: readonly string[] = [
  'admob',
  'expo-ads',
  'applovin',
  'ironsource',
  'unity-ads',
  'adcolony',
  'vungle',
  'analytics',
  'amplitude',
  'mixpanel',
  'telemetry',
  'appsflyer',
  'segment',
  'datadog',
  'newrelic',
  'braze',
  'clevertap',
  'kochava',
  'leanplum',
  'sentry',
  'bugsnag',
  'crashlytics',
  'crashreport',
  'appcenter',
  'firebase',
  'facebook',
  'google-analytics',
];

describe('RF-10: sin SDKs de anuncios, analítica, crash reporting ni telemetría', () => {
  it('ninguna dependencia de package.json coincide con un patrón prohibido', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const dependencias = Object.keys(pkg.dependencies ?? {});
    const encontradas = dependencias.filter((nombre) =>
      PATRONES_PROHIBIDOS.some((patron) => nombre.toLowerCase().includes(patron)),
    );
    expect(encontradas).toEqual([]);
  });
});

// Recoge recursivamente los archivos .ts/.tsx de un directorio (código y
// pruebas de la app: ambos son código que viaja o guía el bundle).
function archivosTsEn(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      salida.push(...archivosTsEn(ruta));
    } else if (/\.(ts|tsx)$/.test(entrada.name)) {
      salida.push(ruta);
    }
  }
  return salida;
}

describe('RF-11: cero URLs remotas en el código y la configuración', () => {
  it('ningún http(s):// en app/, src/, app.json ni metro.config.js', () => {
    const archivos = [
      ...archivosTsEn(path.join(raiz, 'app')),
      ...archivosTsEn(path.join(raiz, 'src')),
      path.join(raiz, 'app.json'),
      path.join(raiz, 'metro.config.js'),
    ];
    const conUrl: string[] = [];
    for (const archivo of archivos) {
      const contenido = fs.readFileSync(archivo, 'utf8');
      if (/https?:\/\//.test(contenido)) {
        conUrl.push(path.relative(raiz, archivo));
      }
    }
    expect(conUrl).toEqual([]);
  });
});
