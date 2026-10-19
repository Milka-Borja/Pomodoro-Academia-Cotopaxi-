// Vista de alarma de primer plano (spec 004, T5): pantalla superpuesta con
// «Fase terminada», la etiqueta de la fase cumplida y el botón «Detener»
// (RF-6, RF-7). Componente PRESENTACIONAL: solo recibe props y callbacks;
// decidir cuándo mostrarse es estado efímero de la pantalla (T7).
// Identidad Cotopaxi (skill cotopaxi-brand): fondo Blanco Nieve, títulos en
// Azul Marino semibold (AA > 4.5:1), botón Azul Marino con texto Blanco
// Nieve, Dorado SOLO como acento (nunca en texto), sin gradientes ni
// animaciones (animationType 'none').
// Es un aviso, no un diálogo: NO se cierra con backdrop ni gesto (no hay
// capa tocable ni allowSwipeDismissal); «Detener» es la salida y el botón
// atrás de Android actúa igual (RF-7: nunca se cierra sin callar el aviso).

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface PhaseEndAlarmProps {
  /** Solo se muestra mientras la alarma deba estar en pantalla (efímero). */
  visible: boolean;
  /** Etiqueta en español de la fase que se cumplió («Estudio»…). */
  phaseLabel: string;
  /** «Detener»: calla el aviso y deja la pantalla en «Fase terminada». */
  onStop: () => void;
}

export function PhaseEndAlarm({ visible, phaseLabel, onStop }: PhaseEndAlarmProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal visible animationType="none" presentationStyle="fullScreen" onRequestClose={onStop}>
      <View style={styles.container}>
        {/* Acento institucional: Dorado como decoración, jamás sobre texto. */}
        <View style={styles.accent} />
        <Text accessible={true} accessibilityRole="text" style={styles.title}>
          Fase terminada
        </Text>
        <Text
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`Fase cumplida: ${phaseLabel}`}
          style={styles.phaseLabel}
        >
          {phaseLabel}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Detener aviso"
          onPress={onStop}
          style={({ pressed }) => [styles.stopButton, pressed && styles.stopButtonPressed]}
        >
          <Text style={styles.stopButtonText}>Detener</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.snowWhite,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
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
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  phaseLabel: {
    color: colors.navyBlue,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  stopButton: {
    // Acción principal: Azul Marino con texto Blanco Nieve (AA).
    backgroundColor: colors.navyBlue,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 220,
    alignItems: 'center',
    marginTop: 8,
  },
  stopButtonPressed: {
    opacity: 0.85,
  },
  stopButtonText: {
    color: colors.snowWhite,
    fontSize: 20,
    fontWeight: '600',
  },
});
