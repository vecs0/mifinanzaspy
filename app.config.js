export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    workerUrl: process.env.EXPO_PUBLIC_WORKER_URL || '',
    workerAppToken: process.env.EXPO_PUBLIC_WORKER_APP_TOKEN || '',
  },
  plugins: [
    ...(config.plugins || []),
    'expo-speech-recognition',
  ],
});
