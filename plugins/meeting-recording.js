const fs = require('node:fs');
const path = require('node:path');
const { AndroidConfig, withDangerousMod, withStringsXml } = require('expo/config-plugins');
const english = require('../src/i18n/native/en.json');

const roomKeep = '-keep class * extends androidx.room.RoomDatabase { <init>(); }';

function withNotificationStrings(config) {
  return withStringsXml(config, (mod) => {
    const items = Object.entries(english.android)
      .filter(([name]) => name.startsWith('expo_audio_recording_'))
      .map(([name, value]) => AndroidConfig.Resources.buildResourceItem({ name, value }));
    mod.modResults = AndroidConfig.Strings.setStringItem(items, mod.modResults);
    return mod;
  });
}

function withWorkManagerKeep(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const rules = path.join(mod.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const text = fs.readFileSync(rules, 'utf8');
      if (!text.includes(roomKeep)) fs.writeFileSync(rules, `${text.trimEnd()}\n\n${roomKeep}\n`);
      return mod;
    },
  ]);
}

module.exports = function withMeetingRecording(config) {
  return withWorkManagerKeep(withNotificationStrings(config));
};
