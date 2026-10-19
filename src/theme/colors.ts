// Paleta institucional de la Academia Cotopaxi — ÚNICA fuente de verdad de
// colores (skill cotopaxi-brand). Prohibido improvisar colores en estilos:
// importar de aquí o variar luminosidad/opacidad de estos mismos.

export const colors = {
  /** Azul Marino Cotopaxi: primario. Acciones principales y textos de lectura. */
  navyBlue: '#1B1D5D',
  /** Dorado Cotopaxi: acento y acciones secundarias. Nunca texto sobre blanco. */
  gold: '#C89B1E',
  /** Blanco Nieve: fondo principal de la app. */
  snowWhite: '#FFFFFF',
  /** Gris neutro claro: solo bordes sutiles o estados deshabilitados. */
  neutralGray: '#E5E5E5',

  // — Derivados del rediseño «fondo claro + tarjetas azules»
  // (specs/rediseño-ui.md, v2 «Minimalista Dinámico») — todos son
  // variaciones de luminosidad/opacidad de la paleta institucional.

  /** Fondo general claro (spec §1: Gris Claro #F4F6F8). */
  smokeBackground: '#F4F6F8',
  /** Relleno de los botones secundarios (Azul Marino al 10 %). */
  navySoft: 'rgba(27, 29, 93, 0.10)',
  /** Texto secundario sobre las tarjetas azules (Blanco al 70 %). */
  onNavyMuted: 'rgba(255, 255, 255, 0.70)',
  /** Borde de los puntos de avance pendientes sobre azul (Blanco al 35 %). */
  dotPendingBorder: 'rgba(255, 255, 255, 0.35)',
  /** Sombra de las tarjetas azules (neutro permitido para sombras). */
  cardShadow: '#000000',
} as const;

/**
 * Tile PNG de 24×24 px con un punto de 2×2 px en Azul Marino sobre
 * transparente: textura sutil tipo «cuaderno» para el fondo claro
 * (specs/rediseño-ui.md §3). Se repite con `resizeMode="repeat"` y se
 * pinta con `opacity: 0.03`. Generado sin dependencias (98 bytes).
 */
export const studyTextureTile =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAKUlEQVR42mOQlo1loCVmGLVg1IJRC0agBf+heOhaMBrJoxaMWjAiLQAA5WhTTEsDW/oAAAAASUVORK5CYII=';
