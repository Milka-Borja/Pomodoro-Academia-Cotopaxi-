// Layout raíz de Expo Router (spec 001, RF-11/RNF-2): rediseño v2 «fondo
// claro + tarjetas azules» (specs/rediseño-ui.md) — fondo Gris Claro para
// que no destellen las transiciones, StatusBar en tono oscuro sobre ese
// fondo claro y tipografía por defecto del sistema (sans-serif, sin
// personalizar). Sin cabecera: la pantalla principal es minimalista.
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';

const styles = StyleSheet.create({
  stackContent: {
    // Mismo tono que el fondo general: transiciones sin destellos.
    backgroundColor: colors.smokeBackground,
  },
});

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ contentStyle: styles.stackContent, headerShown: false }} />
    </>
  );
}
