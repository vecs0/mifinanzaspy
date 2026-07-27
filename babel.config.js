module.exports = function (api) {
  api.cache(true);

  // NativeWind v4 incluye 'react-native-worklets/plugin' en sus plugins,
  // pero react-native-reanimated v4 también lo registra internamente.
  // Filtramos worklets de nativewind para evitar el error "Duplicate plugin".
  const nativewindPlugins = require('nativewind/babel')()
    .plugins
    .filter(p => {
      if (p == null) return false;
      const name = Array.isArray(p) ? p[0] : p;
      return name !== 'react-native-worklets/plugin';
    });

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      ...nativewindPlugins,
      // reanimated/plugin va siempre AL FINAL y registra worklets internamente
      'react-native-reanimated/plugin',
    ],
  };
};
