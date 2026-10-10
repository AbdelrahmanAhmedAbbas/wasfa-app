const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// Sentry's version of Expo's Metro config adds the debug ids that tie uploaded
// source maps to a release, so stack traces point at the original code.
const config = getSentryExpoConfig(__dirname);

module.exports = config;
