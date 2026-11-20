const { withDangerousMod } = require('expo/config-plugins');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const marker = 'buildscript {';

module.exports = function withLiveKitGradle(config) {
  return withDangerousMod(config, [
    'android',
    async (current) => {
      const file = join(current.modRequest.projectRoot, 'node_modules/@livekit/react-native/android/build.gradle');
      const text = readFileSync(file, 'utf8');
      const start = text.indexOf(marker);
      if (start === -1) return current;
      let depth = 0;
      let end = -1;
      for (let at = text.indexOf('{', start); at < text.length; at += 1) {
        if (text[at] === '{') depth += 1;
        if (text[at] === '}') {
          depth -= 1;
          if (depth === 0) {
            end = at + 1;
            break;
          }
        }
      }
      if (end === -1) return current;
      const patched = `${text.slice(0, start)}${text.slice(end).replace(/^\n+/, '')}`;
      writeFileSync(file, patched);
      return current;
    },
  ]);
};
