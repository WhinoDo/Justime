/**
 * Notarization script for macOS builds.
 *
 * This script runs after a successful macOS code signing (electron-builder afterSign hook).
 * It submits the built .app to Apple's notarization service.
 *
 * Prerequisites (set in CI/CD environment):
 *   APPLE_ID          - Apple Developer account email
 *   APPLE_ID_PASSWORD - App-specific password
 *   APPLE_TEAM_ID     - Team ID (optional, inferred from certificate)
 *
 * This is a placeholder. Uncomment and configure when production code signing
 * credentials are available.
 */

/*
import { notarize } from '@electron/notarize';

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    tool: 'notarytool',
    appBundleId: 'com.justime.desktop',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
}
*/

export default async function notarizing() {
  // Notarization is skipped in scaffold phase.
  // Configure APPLE_ID / APPLE_ID_PASSWORD / APPLE_TEAM_ID and uncomment
  // the notarize() call above for production builds.
  console.log(
    '[notarize] Skipped — configure APPLE_ID/APPLE_ID_PASSWORD/APPLE_TEAM_ID for production notarization.'
  );
}
