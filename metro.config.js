// Configuración de Metro (spec 003, T9): parche documentado al bug upstream de
// expo-notifications 57.0.x en Expo Go Android.
//
// El problema: build/TopicSubscriptionModule.android.js del paquete ejecuta
// `requireNativeModule('ExpoTopicSubscriptionModule')` en la CARGA del módulo, y
// ese módulo nativo NO existe en Expo Go (los temas/push se excluyen de Go
// desde SDK 53). Resultado: cualquier import de expo-notifications revienta la
// app en Expo Go con "Cannot find native module 'ExpoTopicSubscriptionModule'".
//
// La solución: redirigir esa ÚNICA resolución interna (solo Android) al stub
// genérico SIN nativo que trae el propio paquete (build/TopicSubscriptionModule.js,
// funciones no-op), que ya es el fallback que el paquete usa en iOS. La app no
// usa topics; las notificaciones locales que sí usamos (programar/cancelar
// avisos de fin de fase) dependen de otros módulos nativos que SÍ están en
// Expo Go. Misma técnica que el workaround oficial del issue expo/expo#48390.
// ELIMINAR este archivo cuando Expo arregle el import en una versión futura.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'android' &&
    moduleName === './TopicSubscriptionModule' &&
    context.originModulePath.includes('expo-notifications')
  ) {
    const paquete = path.dirname(require.resolve('expo-notifications/package.json'));
    return {
      filePath: path.join(paquete, 'build', 'TopicSubscriptionModule.js'),
      type: 'sourceFile',
    };
  }
  // Se llama SIEMPRE al resolver anterior para no romper nada más.
  return baseResolveRequest
    ? baseResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
