/**
 * Pure route logic shared by the app and the proxy.
 *
 * This package must stay free of React Native, Node, Expo and I/O imports.
 * Real exports (decode, dedupe, cost, rank, diff, format) land in R-03 to R-05.
 */

/** Package name, used to prove the workspace resolves from other packages. */
export const PACKAGE_NAME = '@routes/routing-core';
