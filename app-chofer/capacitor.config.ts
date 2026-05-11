import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.transportadora.chofer',
  appName: 'App Chofer',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
      appReadyTimeout: 10000,
      responseTimeout: 20,
      autoDeleteFailed: true,
      autoDeletePrevious: false,
      resetWhenUpdate: true,
      allowManualBundleError: true,
      version: '1.0'
    }
  }
};

export default config;
