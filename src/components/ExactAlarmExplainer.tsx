// Modal de invitación única a «Alarmas y recordatorios» (spec 004, T10,
// cambio 1; RF-13, RF-14): se muestra la PRIMERA vez en Android ≥ 12 con
// notificaciones concedidas, para que el alumno active las alarmas exactas y
// el aviso sea puntual. Componente PRESENTACIONAL: solo props y callbacks;
// textos en español. Identidad Cotopaxi (skill cotopaxi-brand), mismo patrón
// visual que PermissionExplainer: tarjeta sobre Blanco Nieve, títulos y textos
// en Azul Marino (AA > 4.5:1), botón primario Azul Marino con texto Blanco
// Nieve y dorado SOLO como acento y acción secundaria «Ahora no» (Azul Marino
// sobre Dorado, AA; nunca Dorado en texto). Sin gradientes ni animaciones
// (animationType 'none'); ni el backdrop ni el gesto de atrás cierran el
// modal (rn-conventions): hay que elegir. Ambas acciones arrancan la sesión en
// la pantalla —nunca bloquean el temporizador (RF-14)—; el texto cubre el caso
// «ya estaba activado» porque desde JS no puede leerse el estado del permiso
// (decisión técnica 9).

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface ExactAlarmExplainerProps {
  /** Se muestra solo si la matriz de invitación resolvió 'invite' (RF-13). */
  visible: boolean;
  /** «Abrir ajustes»: cierra el modal y abre la pantalla del sistema (RF-13). */
  onOpenSettings: () => void;
  /** «Ahora no»: cierra, marca la invitación e informa una vez (RF-14). */
  onSkip: () => void;
}

export function ExactAlarmExplainer({
  visible,
  onOpenSettings,
  onSkip,
}: ExactAlarmExplainerProps) {
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
            Alarmas y recordatorios
          </Text>
          <Text accessible={true} accessibilityRole="text" style={styles.body}>
            «Alarmas y recordatorios» hace que el aviso suene a la hora exacta, aunque
            la app esté cerrada. Si ya está activado, no cambia nada.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir ajustes"
            onPress={onOpenSettings}
            style={({ pressed }) => [
              styles.openSettingsButton,
              pressed && styles.openSettingsButtonPressed,
            ]}
          >
            <Text style={styles.openSettingsButtonText}>Abrir ajustes</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ahora no"
            onPress={onSkip}
            style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
          >
            <Text style={styles.skipButtonText}>Ahora no</Text>
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
  openSettingsButton: {
    // Acción principal: Azul Marino con texto Blanco Nieve (AA).
    backgroundColor: colors.navyBlue,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    marginTop: 8,
  },
  openSettingsButtonPressed: {
    opacity: 0.85,
  },
  openSettingsButtonText: {
    color: colors.snowWhite,
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    // Acción secundaria: Dorado con texto Azul Marino (mismo patrón que
    // «Reiniciar»; el Dorado sobre Blanco para texto está prohibido).
    backgroundColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  skipButtonPressed: {
    opacity: 0.85,
  },
  skipButtonText: {
    color: colors.navyBlue,
    fontSize: 17,
    fontWeight: '600',
  },
});
