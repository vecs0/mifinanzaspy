// metro.config.js — Configuración del bundler para Expo + NativeWind v4
// NativeWind v4 requiere el wrapper withNativeWind para procesar estilos CSS.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  // Punto de entrada CSS con las directivas @tailwind
  input: './global.css',
});
