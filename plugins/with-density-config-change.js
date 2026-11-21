const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withDensityConfigChange(config) {
  return withAndroidManifest(config, (current) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(current.modResults);
    const changes = new Set((activity.$['android:configChanges'] ?? '').split('|').filter(Boolean));
    changes.add('density');
    activity.$['android:configChanges'] = [...changes].join('|');
    return current;
  });
};
