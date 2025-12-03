import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jushi.agent',
  appName: 'Jushi Agent',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    url: 'http://10.0.2.2:3000', // Default to Android Emulator localhost
    cleartext: true
  }
};

export default config;
