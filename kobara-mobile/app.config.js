const fs = require('fs');
const path = require('path');

const { expo } = require('./app.json');

const pluginNodeModules = [
  'expo-router',
  'expo-secure-store',
  'expo-local-authentication',
  'expo-notifications',
  'expo-splash-screen',
  'expo-web-browser',
];

const canResolveConfigPlugins = pluginNodeModules.every((packageName) =>
  fs.existsSync(path.join(__dirname, 'node_modules', packageName))
);

module.exports = ({ config }) => ({
  ...config,
  ...expo,
  plugins: canResolveConfigPlugins ? expo.plugins : [],
});

