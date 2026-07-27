export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
    workerUrl: process.env.EXPO_PUBLIC_WORKER_URL || '',
  },
  plugins: [
    ...(config.plugins || []),
    'expo-speech-recognition',
  ],
});
