// Pantalla de Ajustes (spec 005, T5–T6): los 4 campos de la técnica con su
// rango visible SIEMPRE debajo (RF-11), teclado numérico con filtro de
// dígitos (RF-12) y un pie fijo FUERA del scroll con «Restablecer» y
// «Guardar» para que el teclado no lo tape (RF-13). Guardar valida de forma
// TODO O NADA con los mensajes del dominio —bajo cada campo, sin diálogos ni
// rojos puros (RF-10; cotopaxi-brand)—; solo con el formulario válido
// persiste y vuelve sin mensaje (RF-3). Restablecer (RF-9, decisión 9)
// pide confirmación nativa (rn-conventions: acción crítica) y al confirmar
// persiste los defaults y cierra SIN pulsar Guardar. Salir sin guardar
// descarta en silencio (RF-4): nada escribe en storage sin «Guardar» o
// «Restablecer» confirmado.
// Estilos: paleta institucional única de @/theme/colors (skill
// cotopaxi-brand); textos en español (rn-conventions).
// Rediseño v2 «fondo claro + tarjetas azules» (specs/rediseño-ui.md): fondo
// Gris Claro con textura sutil tipo cuaderno, campos en tarjetas Azul Marino
// con sombra sutil, textos blancos dentro de las tarjetas y botón «Guardar»
// en Dorado (píldora). Sin blur ni degradados: las dependencias del estilo
// anterior se eliminaron del proyecto. SOLO cambios presentacionales:
// validación, persistencia y navegación intactas.
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  DEFAULT_SETTINGS,
  formatRangeHint,
  validateSettings,
  type PomodoroSettings,
  type SettingsField,
} from '@/domain/settings';
import { loadSettings, saveSettings } from '@/storage/cycleStorage';
import { colors, studyTextureTile } from '@/theme/colors';

/** Etiquetas en español de cada campo (rn-conventions: textos en español). */
const CAMPOS: { campo: SettingsField; etiqueta: string }[] = [
  { campo: 'studyMinutes', etiqueta: 'Tiempo de estudio' },
  { campo: 'shortBreakMinutes', etiqueta: 'Descanso corto' },
  { campo: 'longBreakMinutes', etiqueta: 'Descanso largo' },
  { campo: 'pomodorosPerCycle', etiqueta: 'Pomodoros por ciclo' },
];

/** Formulario: los 4 campos como texto (el usuario escribe, el dominio valida). */
type Formulario = Record<SettingsField, string>;

const FORM_VACIO: Formulario = {
  studyMinutes: '',
  shortBreakMinutes: '',
  longBreakMinutes: '',
  pomodorosPerCycle: '',
};

/** Ajustes guardados → formulario de textos (hidratación al montar). */
function aFormulario(settings: PomodoroSettings): Formulario {
  return {
    studyMinutes: String(settings.studyMinutes),
    shortBreakMinutes: String(settings.shortBreakMinutes),
    longBreakMinutes: String(settings.longBreakMinutes),
    pomodorosPerCycle: String(settings.pomodorosPerCycle),
  };
}

/**
 * Formulario → ajustes. Solo se invoca tras `validateSettings` vacío: los
 * textos son enteros en rango (RF-10, RF-12), así que `Number` es seguro y
 * lo que se persiste son números, no texto (RF-2).
 */
function aSettings(form: Formulario): PomodoroSettings {
  return {
    studyMinutes: Number(form.studyMinutes),
    shortBreakMinutes: Number(form.shortBreakMinutes),
    longBreakMinutes: Number(form.longBreakMinutes),
    pomodorosPerCycle: Number(form.pomodorosPerCycle),
  };
}

export default function SettingsScreen() {
  const [form, setForm] = useState<Formulario>(FORM_VACIO);
  const [errores, setErrores] = useState<Partial<Record<SettingsField, string>>>({});
  // Hasta hidratar, «Guardar» está deshabilitado: sin esto, un pulso rápido
  // persistiría el formulario vacío y borraría los ajustes guardados (RF-2).
  const [formCargado, setFormCargado] = useState(false);

  useEffect(() => {
    // Hidratación (plan §3): los ajustes guardados o, si no hay ninguno, los
    // defaults de la técnica 25/5/15/4 (RF-9). JSON corrupto → el codec
    // devuelve null → defaults (RF-2).
    let cancelled = false;
    (async () => {
      const settings = (await loadSettings()) ?? DEFAULT_SETTINGS;
      if (cancelled) {
        return;
      }
      setForm(aFormulario(settings));
      setFormCargado(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (campo: SettingsField, texto: string) => {
    // RF-12: el filtro de dígitos vive AQUÍ; el teclado numérico es solo la
    // pista. Letras, signos, espacios y decimales no entran al formulario.
    if (!/^[0-9]*$/.test(texto)) {
      return;
    }
    setForm((prev) => ({ ...prev, [campo]: texto }));
    // El error se limpia al corregir SU campo (feedback inmediato, RF-10).
    setErrores((prev) =>
      prev[campo] === undefined ? prev : { ...prev, [campo]: undefined },
    );
  };

  const handleGuardar = async () => {
    const nuevos = validateSettings(form);
    if (Object.keys(nuevos).length > 0) {
      // RF-10: error bajo CADA campo inválido, sin Alert y sin persistir
      // NADA del formulario (todo o nada). Los mensajes citan el rango.
      setErrores(nuevos);
      return;
    }
    setErrores({});
    await saveSettings(aSettings(form));
    // RF-3: cierra Ajustes y vuelve sin ningún mensaje.
    router.back();
  };

  const handleRestablecer = () => {
    // RF-9 + decisión 9: acción crítica → confirmación nativa
    // (rn-conventions). La confirmación MISMA es la acción: persiste los
    // defaults 25/5/15/4 y cierra sin pasar por «Guardar»; cancelar no
    // escribe nada. La principal aplica los nuevos ajustes al volver
    // (useFocusEffect de T4) y el contador del ciclo no se toca.
    Alert.alert(
      '¿Restablecer los ajustes?',
      'Los tiempos volverán a 25, 5 y 15 minutos, y 4 pomodoros por ciclo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer',
          onPress: async () => {
            await saveSettings(DEFAULT_SETTINGS);
            // RF-9: cierra sin ningún mensaje adicional.
            router.back();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Textura sutil de fondo (spec §3): puntos muy separados al 3 % de
          opacidad, aspecto de «cuaderno» de estudio. Decorativa y oculta a
          los lectores de pantalla; no intercepta toques. */}
      <Image
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
        resizeMode="repeat"
        source={{ uri: studyTextureTile }}
        style={styles.texture}
      />
      {/* Cabecera (RF-4): «Atrás» vuelve sin escribir nada. */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atrás"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backArrow}>{'←'}</Text>
        </Pressable>
        <Text accessible={true} accessibilityRole="header" style={styles.headerTitle}>
          Ajustes
        </Text>
      </View>
      <KeyboardAvoidingView
        style={styles.content}
        // RF-13: «padding» en AMBAS plataformas (desviación del plan §5, que
        // pedía «Android en resize»: en el entorno real la ventana Android no
        // siempre se encoge con el teclado y KAV no admite 'resize' como
        // valor). Padding es auto-correctivo: KAV añade SOLO el espacio que
        // falta según la posición real del teclado —si la ventana ya se
        // encogió, añade 0—, así que el pie nunca queda tapado.
        behavior="padding"
      >
        <ScrollView
          // flex:1: el scroll ocupa todo el espacio que deja libre el
          // padding del teclado y el pie se queda pegado al fondo del área
          // visible en vez de desbordarse por debajo (rn-conventions: el
          // teclado no tapa «Guardar» — RF-13).
          style={styles.scroll}
          contentContainerStyle={styles.form}
          // Permite pulsar «Guardar» con el teclado abierto sin cerrarlo
          // primero (rn-conventions; RF-13).
          keyboardShouldPersistTaps="handled"
        >
          {CAMPOS.map(({ campo, etiqueta }) => (
            // Tarjeta azul (spec §1-2): cada campo vive en su propia
            // tarjeta Azul Marino con sombra sutil, esquinas redondeadas y
            // SIN línea de borde.
            <View key={campo} style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>{etiqueta}</Text>
              <TextInput
                accessibilityLabel={etiqueta}
                keyboardType="numeric"
                value={form[campo]}
                onChangeText={(texto) => handleChange(campo, texto)}
                style={[styles.input, errores[campo] !== undefined && styles.inputError]}
              />
              {/* RF-11: el rango SIEMPRE visible, antes de equivocarse. */}
              <Text style={styles.hint}>{formatRangeHint(campo)}</Text>
              {errores[campo] !== undefined && (
                // RF-10: error bajo el campo, en Blanco Puro semibold
                // (sin rojos puros: prohibidos en cotopaxi-brand) y con
                // rol de alerta.
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {errores[campo]}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
        {/* Pie fijo FUERA del scroll (RF-13): el teclado no tapa los botones. */}
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restablecer"
            disabled={!formCargado}
            onPress={handleRestablecer}
            style={({ pressed }) => [
              styles.resetButton,
              !formCargado && styles.resetButtonDisabled,
              pressed && formCargado && styles.resetButtonPressed,
            ]}
          >
            <Text style={styles.resetButtonText}>Restablecer</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Guardar"
            disabled={!formCargado}
            onPress={handleGuardar}
            style={({ pressed }) => [
              styles.saveButton,
              !formCargado && styles.saveButtonDisabled,
              pressed && formCargado && styles.saveButtonPressed,
            ]}
          >
            <Text
              style={[styles.saveButtonText, !formCargado && styles.saveButtonTextDisabled]}
            >
              Guardar
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    // Fondo general claro (spec rediseño-ui.md §1: Gris Claro).
    flex: 1,
    backgroundColor: colors.smokeBackground,
  },
  texture: {
    // Textura sutil tipo «cuaderno» (spec §3): tile de puntos repetido al
    // 3 % de opacidad, detrás de todo y sin interceptar toques.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.03,
    pointerEvents: 'none',
  },
  header: {
    // Sin línea de borde (spec §2): cabecera limpia sobre el fondo claro.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    // Área táctil ≥ 44 px con el padding + hitSlop (rn-conventions).
    padding: 12,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backArrow: {
    // Glifo monócromo en Azul Marino (sobre Gris Claro: AA > 4.5:1).
    color: colors.navyBlue,
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    // Texto fuera de las tarjetas en Azul Marino (spec §1).
    color: colors.navyBlue,
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scroll: {
    // Ver comentario en el uso: mantiene el pie al fondo del área visible.
    flex: 1,
  },
  form: {
    padding: 24,
    gap: 20,
  },
  fieldCard: {
    // Tarjeta azul de cada campo (spec §1-2): Azul Marino sólido con sombra
    // sutil de elevación, esquinas redondeadas y SIN línea de borde.
    gap: 6,
    borderRadius: 24,
    backgroundColor: colors.navyBlue,
    padding: 16,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  fieldLabel: {
    // Blanco Puro sobre la tarjeta Azul Marino (spec §1: AA ≈ 15:1).
    color: colors.snowWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    // Campo de entrada: Blanco Puro sobre la tarjeta azul para maximizar la
    // legibilidad de lo que escribe el alumno; texto Azul Marino (AA).
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    color: colors.navyBlue,
    backgroundColor: colors.snowWhite,
  },
  inputError: {
    // Campo inválido: borde Dorado de 2 px (acento permitido, nunca rojos
    // puros: cotopaxi-brand).
    borderWidth: 2,
    borderColor: colors.gold,
  },
  hint: {
    // Rango en Blanco al 70 % sobre la tarjeta azul (variación de opacidad
    // permitida; AA verificado en estilos).
    color: colors.onNavyMuted,
    fontSize: 13,
  },
  errorText: {
    // Blanco Puro semibold: sobrio y con AA, nunca rojo/verde puro.
    color: colors.snowWhite,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    // Sin línea de borde (spec §2): el pie se separa solo con espacio.
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  resetButton: {
    // Secundaria (spec §2): fondo semitransparente en Azul Marino que no
    // compite con la acción principal; texto Azul Marino (AA sobre claro).
    backgroundColor: colors.navySoft,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 100,
    minWidth: 220,
    alignItems: 'center',
  },
  resetButtonDisabled: {
    // Estado deshabilitado en gris neutro de la paleta (permitido).
    backgroundColor: colors.neutralGray,
  },
  resetButtonPressed: {
    opacity: 0.85,
  },
  resetButtonText: {
    color: colors.navyBlue,
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    // Primaria (spec §1-2): píldora Dorado con texto Blanco según la spec —
    // decisión explícita del usuario pese al contraste ≈ 2.6:1 (por debajo
    // del AA que exige cotopaxi-brand; queda registrado aquí). Mismo patrón
    // que el botón principal de la pantalla de estudio.
    backgroundColor: colors.gold,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 100,
    minWidth: 220,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    // Estado deshabilitado en gris neutro de la paleta (permitido).
    backgroundColor: colors.neutralGray,
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonText: {
    color: colors.snowWhite,
    fontSize: 18,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    // Legible sobre el gris claro del estado deshabilitado.
    color: colors.navyBlue,
  },
});
