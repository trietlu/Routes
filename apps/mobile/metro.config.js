// Expo's default Metro config handles npm workspaces (watch folders and
// node_modules lookup) since SDK 52; see the Expo monorepo guide.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
