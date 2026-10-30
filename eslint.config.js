// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-router',
              importNames: ['router'],
              message:
                'Use useRouter() inside the component. The module-level router is unbound after an Android Activity relaunch (expo/expo#51859) and the next call crashes the release build.',
            },
          ],
        },
      ],
    },
  },
]);
