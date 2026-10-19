// Modal de explicación del permiso de notificaciones (spec 004, T5, RF-10):
// la app explica POR QUÉ necesita el permiso ANTES de disparar el diálogo del
// sistema; «Continuar» es la única salida y en T6 dispara la solicitud.
// Componente PRESENTACIONAL: solo recibe props y callbacks; textos en español.
// Identidad Cotopaxi (skill cotopaxi-brand): tarjeta sobre Blanco Nieve,
// títulos y textos en Azul Marino (AA > 4.5:1), botón Azul Marino con texto
// Blanco Nieve, Dorado SOLO como acento; sin gradientes ni animaciones
// (animationType 'none'). El fondo atenuado es Azul Marino con opacidad,
// variación de luminosidad permitida. No se cierra con backdrop ni gesto
// (el fondo es una View sin tocar): «Continuar» es la única acción.

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface PermissionExplainerProps {
  /** Se muestra al primer «Iniciar» (estado efímero de la pantalla, T6). */
  visible: boolean;
  /** «Continuar»: cierra este aviso y dispara el diálogo del sistema (T6). */
  onContinue: () => void;
}

export function PermissionExplainer({ visible, onContinue }: PermissionExplainerProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal visible animationType="none" transparent onRequestClose={() => {}}>
      <View style={styles.root}>
        {/* Atenuado: Azul Marino a opacidad (no es un backdrop tocable). */}
        <View style={styles.backdrop} />
        <View style={styles.card}>
          <View style={styles.accent} />
          <Text accessible={true} accessibilityRole="text" style={styles.title}>
            Permiso de notificaciones
          </Text>
          <Text accessible={true} accessibilityRole="text" style={styles.body}>
            Necesitamos poder avisarte cuando termine el tiempo, aunque la app esté
            cerrada o el celular en silencio.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continuar"
            onPress={onContinue}
            style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed]}
          >
            <Text style={styles.continueButtonText}>Continuar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.navyBlue,
    opacity: 0.6,
  },
  card: {
    backgroundColor: colors.snowWhite,
    borderRadius: 16,
    padding: 24,
    gap: 16,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  accent: {
    width: 64,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  title: {
    // Azul Marino sobre Blanco Nieve: contraste AA > 4.5:1 (cotopaxi-brand).
    color: colors.navyBlue,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    color: colors.navyBlue,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
  continueButton: {
    // Acción principal: Azul Marino con texto Blanco Nieve (AA).
    backgroundColor: colors.navyBlue,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    marginTop: 8,
  },
  continueButtonPressed: {
    opacity: 0.85,
  },
  continueButtonText: {
    color: colors.snowWhite,
    fontSize: 18,
    fontWeight: '600',
  },
});
