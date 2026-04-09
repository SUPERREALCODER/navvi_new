const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Custom Expo config plugin to inject a placeholder Google Maps API key
 * into AndroidManifest.xml. This prevents the react-native-maps SDK from
 * crashing on startup with "API key not found", while the app uses OSM tiles.
 */
const withGoogleMapsKey = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application[0];

    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // Remove existing key if any (avoid duplicates)
    application['meta-data'] = application['meta-data'].filter(
      (item) => item.$['android:name'] !== 'com.google.android.geo.API_KEY'
    );

    // Add the placeholder key at the top of meta-data
    application['meta-data'].unshift({
      $: {
        'android:name': 'com.google.android.geo.API_KEY',
        'android:value': 'DUMMY_KEY_TO_PREVENT_CRASH',
      },
    });

    return config;
  });
};

module.exports = withGoogleMapsKey;
