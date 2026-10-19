// Pruebas de la pantalla de Ajustes (spec 005, T5–T6): los 4 rangos visibles
// siempre bajo su campo (RF-11), teclado numérico y filtro de letras (RF-12),
// guardar válido (RF-3) e inválido todo-o-nada sin diálogo (RF-10),
// «Restablecer» con confirmación nativa que persiste los defaults y cierra
// sin pulsar Guardar (RF-9, decisión 9), «Atrás» sin escribir (RF-4) y los
// botones estructuralmente en el pie, dentro del KeyboardAvoidingView y
// fuera del ScrollView (RF-13). Reloj de pared: sin timers.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, StyleSheet } from 'react-native';

// Mock del envoltorio de AsyncStorage: la pantalla solo carga y guarda
// ajustes; sin este mock, el storage real lanza Invariant Violation en Jest.
jest.mock('../../src/storage/cycleStorage', () => ({
  SETTINGS_KEY: '@pomodoro/settings',
  loadSettings: jest.fn(async () => null),
  saveSettings: jest.fn(async () => undefined),
}));

// Mock de expo-router: la pantalla vuelve con router.back() (RF-3, RF-4).
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

import * as cycleStorage from '../../src/storage/cycleStorage';
import { router } from 'expo-router';

import SettingsScreen from '../settings';

const loadSettings = jest.mocked(cycleStorage.loadSettings);
const saveSettings = jest.mocked(cycleStorage.saveSettings);
const back = jest.mocked(router.back);

async function renderAjustes() {
  await render(<SettingsScreen />);
  // Drena la hidratación del formulario (loadSettings → form).
  await act(async () => {});
}

describe('pantalla de ajustes (spec 005, T5–T6 — RF-3, RF-4, RF-9 a RF-13)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('muestra SIEMPRE los 4 rangos bajo sus campos, antes de equivocarse (RF-11)', async () => {
    await renderAjustes();

    // Estudio y descanso largo comparten rango 1–60 min.
    expect(screen.getAllByText('1–60 min')).toHaveLength(2);
    expect(screen.getByText('1–30 min')).toBeTruthy();
    expect(screen.getByText('1–10')).toBeTruthy();
  });

  it('los 4 campos usan teclado numérico y las letras/símbolos no entran (RF-12)', async () => {
    await renderAjustes();

    const estudio = screen.getByLabelText('Tiempo de estudio');
    expect(estudio.props.keyboardType).toBe('numeric');

    // Filtro de dígitos: nada de letras, signos ni mezclas.
    await fireEvent.changeText(estudio, 'abc');
    await fireEvent.changeText(estudio, '2a5');
    await fireEvent.changeText(estudio, '-5');
    await fireEvent.changeText(estudio, '3.5');
    expect(screen.getByLabelText('Tiempo de estudio').props.value).toBe('25');

    await fireEvent.changeText(estudio, '40');
    expect(screen.getByLabelText('Tiempo de estudio').props.value).toBe('40');
  });

  it('hidrata el formulario desde los ajustes guardados (RF-2)', async () => {
    loadSettings.mockResolvedValueOnce({
      studyMinutes: 40,
      shortBreakMinutes: 10,
      longBreakMinutes: 20,
      pomodorosPerCycle: 3,
    });

    await renderAjustes();

    expect(screen.getByLabelText('Tiempo de estudio').props.value).toBe('40');
    expect(screen.getByLabelText('Descanso corto').props.value).toBe('10');
    expect(screen.getByLabelText('Descanso largo').props.value).toBe('20');
    expect(screen.getByLabelText('Pomodoros por ciclo').props.value).toBe('3');
  });

  it('sin ajustes guardados hidrata con los defaults de la técnica 25/5/15/4 (RF-9)', async () => {
    await renderAjustes();

    expect(screen.getByLabelText('Tiempo de estudio').props.value).toBe('25');
    expect(screen.getByLabelText('Descanso corto').props.value).toBe('5');
    expect(screen.getByLabelText('Descanso largo').props.value).toBe('15');
    expect(screen.getByLabelText('Pomodoros por ciclo').props.value).toBe('4');
  });

  it('Guardar con campo vacío: error bajo ese campo y NI guardar NI volver, sin Alert (RF-10)', async () => {
    await renderAjustes();

    await fireEvent.changeText(screen.getByLabelText('Descanso corto'), '');
    await fireEvent.press(screen.getByLabelText('Guardar'));
    await act(async () => {});

    expect(screen.getByText('Escribe un valor. Puedes usar 1–30 min.')).toBeTruthy();
    expect(saveSettings).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('Guardar con valor fuera de rango: error con el rango bajo el campo y nada se guarda (RF-10)', async () => {
    await renderAjustes();

    await fireEvent.changeText(screen.getByLabelText('Tiempo de estudio'), '70');
    await fireEvent.changeText(screen.getByLabelText('Pomodoros por ciclo'), '0');
    await fireEvent.press(screen.getByLabelText('Guardar'));
    await act(async () => {});

    expect(screen.getByText('Usa un valor entre 1 y 60.')).toBeTruthy();
    expect(screen.getByText('Usa un valor entre 1 y 10.')).toBeTruthy();
    expect(saveSettings).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('todo o nada: con un solo campo mal NO se guarda NADA del formulario (RF-10)', async () => {
    await renderAjustes();

    await fireEvent.changeText(screen.getByLabelText('Tiempo de estudio'), '40'); // válido
    await fireEvent.changeText(screen.getByLabelText('Descanso largo'), ''); // inválido
    await fireEvent.press(screen.getByLabelText('Guardar'));
    await act(async () => {});

    expect(saveSettings).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('corregir un campo limpia SU error y deja pasar el siguiente Guardar (RF-10)', async () => {
    await renderAjustes();

    await fireEvent.changeText(screen.getByLabelText('Pomodoros por ciclo'), '');
    await fireEvent.press(screen.getByLabelText('Guardar'));
    await act(async () => {});
    expect(screen.getByText('Escribe un valor. Puedes usar 1–10.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Pomodoros por ciclo'), '3');
    expect(screen.queryByText('Escribe un valor. Puedes usar 1–10.')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Guardar'));
    await act(async () => {});
    expect(saveSettings).toHaveBeenCalledWith({
      studyMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      pomodorosPerCycle: 3,
    });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('Guardar válido: persiste ENTEROS y vuelve sin ningún mensaje (RF-3)', async () => {
    await renderAjustes();

    await fireEvent.changeText(screen.getByLabelText('Tiempo de estudio'), '40');
    await fireEvent.changeText(screen.getByLabelText('Descanso corto'), '10');
    await fireEvent.press(screen.getByLabelText('Guardar'));
    await act(async () => {});

    expect(saveSettings).toHaveBeenCalledWith({
      studyMinutes: 40,
      shortBreakMinutes: 10,
      longBreakMinutes: 15,
      pomodorosPerCycle: 4,
    });
    expect(back).toHaveBeenCalledTimes(1);
    // RF-3: sin mensaje de éxito ni ningún Alert.
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('«Restablecer» pide confirmación con «Cancelar»/«Restablecer» y aún NO escribe nada (RF-9)', async () => {
    await renderAjustes();

    await fireEvent.press(screen.getByLabelText('Restablecer'));
    await act(async () => {});

    // Diálogo nativo con los textos del plan §4 (rn-conventions: acción crítica).
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [titulo, mensaje, botones] = jest.mocked(Alert.alert).mock.calls[0];
    expect(titulo).toBe('¿Restablecer los ajustes?');
    expect(mensaje).toBe('Los tiempos volverán a 25, 5 y 15 minutos, y 4 pomodoros por ciclo.');
    expect(botones?.map((b) => b.text)).toEqual(['Cancelar', 'Restablecer']);

    // Hasta CONFIRMAR no se escribe nada ni se cierra la pantalla.
    expect(saveSettings).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('confirmar «Restablecer» persiste los defaults y cierra SIN pulsar Guardar (RF-9, decisión 9)', async () => {
    await renderAjustes();

    // Con cambios sin guardar en el formulario: restablecer los descarta.
    await fireEvent.changeText(screen.getByLabelText('Tiempo de estudio'), '40');
    await fireEvent.press(screen.getByLabelText('Restablecer'));
    await act(async () => {});

    const botones = jest.mocked(Alert.alert).mock.calls[0][2];
    const confirmar = botones?.find((b) => b.text === 'Restablecer');
    await act(async () => {
      await confirmar?.onPress?.();
    });

    // La confirmación ES la acción: defaults persistidos y cierre, sin Guardar.
    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(saveSettings).toHaveBeenCalledWith({
      studyMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      pomodorosPerCycle: 4,
    });
    expect(back).toHaveBeenCalledTimes(1);
    // Sin ningún mensaje adicional: solo existió el diálogo de confirmación.
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it('cancelar «Restablecer» no escribe nada ni cierra la pantalla (RF-9)', async () => {
    await renderAjustes();

    await fireEvent.press(screen.getByLabelText('Restablecer'));
    await act(async () => {});

    const botones = jest.mocked(Alert.alert).mock.calls[0][2];
    const cancelar = botones?.find((b) => b.text === 'Cancelar');
    cancelar?.onPress?.();

    expect(saveSettings).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('los botones están en el pie: FUERA del ScrollView y un nivel por debajo de su envoltorio (RF-13)', async () => {
    await renderAjustes();

    // RTL v14 solo expone hosts en el árbol: se afirma la estructura
    // recorriendo los ancestros por tipo de host (View, RCTScrollView…).
    type Nodo = NonNullable<typeof screen.root>;

    const cadenaDe = (desde: Nodo): string[] => {
      const cadena: string[] = [];
      let nodo: Nodo | null = desde;
      while (nodo) {
        cadena.unshift(nodo.type);
        nodo = nodo.parent;
      }
      return cadena;
    };

    const guardar = screen.getByLabelText('Guardar');
    const scroll = screen.root?.queryAll((n) => n.type.includes('ScrollView'))[0];
    expect(scroll).toBeDefined();

    const cadenaGuardar = cadenaDe(guardar);
    const cadenaScroll = cadenaDe(scroll as Nodo);
    const cadenaCampo = cadenaDe(screen.getByLabelText('Tiempo de estudio'));

    // «Guardar» NO está dentro del scroll: ningún ancestro es el scroll.
    expect(cadenaGuardar.some((tipo) => tipo.includes('ScrollView'))).toBe(false);
    // Control positivo: los campos SÍ están dentro del scroll (el formulario
    // scrollea y el pie no).
    expect(cadenaCampo.some((tipo) => tipo.includes('ScrollView'))).toBe(true);
    // El scroll CRECE (flex:1): en Android, con la ventana ajustada al
    // teclado, es lo que hace que el scroll se contraiga y «Guardar» suba con
    // él en vez de quedar tapado (rf-13, rn-conventions).
    const estiloScroll = StyleSheet.flatten(
      (scroll as Nodo).props.style as Parameters<typeof StyleSheet.flatten>[0],
    ) as { flex?: number } | undefined;
    expect(estiloScroll?.flex).toBe(1);
    // Comparte el MISMO envoltorio que el scroll (KeyboardAvoidingView): los
    // ancestros comunes son los del scroll menos el propio scroll…
    const prefijoComun = cadenaScroll.slice(0, -1);
    expect(cadenaGuardar.slice(0, prefijoComun.length)).toEqual(prefijoComun);
    // …y ese envoltorio es un KeyboardAvoidingView de verdad: su View host
    // recibe onLayout (lo adjunta solo KeyboardAvoidingView en este árbol)…
    expect(typeof (scroll as Nodo).parent?.props.onLayout).toBe('function');
    // …con «Guardar» colgando por debajo, a nivel de pie (más profundo).
    expect(cadenaGuardar.length).toBeGreaterThan(prefijoComun.length);
    // «Restablecer» también vive en el pie, fuera del scroll (plan §5).
    expect(
      cadenaDe(screen.getByLabelText('Restablecer')).some((tipo) => tipo.includes('ScrollView')),
    ).toBe(false);
  });

  it('«Atrás» en la cabecera vuelve sin escribir nada (RF-4)', async () => {
    await renderAjustes();

    await fireEvent.changeText(screen.getByLabelText('Tiempo de estudio'), '40');
    await fireEvent.press(screen.getByLabelText('Atrás'));
    await act(async () => {});

    expect(back).toHaveBeenCalledTimes(1);
    expect(saveSettings).not.toHaveBeenCalled();
  });
});
