const { withAndroidManifest } = require('expo/config-plugins');

const extra = ['smallestScreenSize', 'density'];

module.exports = function withCallScreen(config) {
  return withAndroidManifest(config, (current) => {
    const application = current.modResults.manifest.application?.[0];
    const activity = application?.activity?.find((item) => item.$['android:name'] === '.MainActivity');
    if (!activity) return current;
    activity.$['android:supportsPictureInPicture'] = 'true';
    const changes = String(activity.$['android:configChanges'] ?? '').split('|').filter(Boolean);
    for (const change of extra) if (!changes.includes(change)) changes.push(change);
    activity.$['android:configChanges'] = changes.join('|');
    return current;
  });
};
