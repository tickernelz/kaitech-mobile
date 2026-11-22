/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  extraSources: [
    { type: 'dir', filePath: 'modules/kaitech-call', reasons: ['kaitechCallModule'] },
    { type: 'dir', filePath: 'plugins', reasons: ['localConfigPlugins'] },
  ],
};
