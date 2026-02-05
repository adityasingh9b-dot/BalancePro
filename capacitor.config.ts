import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.balancepro.studio',
  appName: 'BalancePro',
  webDir: 'dist',
  server: {
    androidScheme: 'https', // Ise 'https' hi rakhna
    cleartext: true
  }
};

export default config;
