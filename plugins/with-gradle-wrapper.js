const { withDangerousMod } = require('expo/config-plugins');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const gradle = {
  version: '9.9.2',
  sha256: '971fcd7150ca4ba04852c0b2ca0d2d0ab9468e14b03473eab19528809914c76b',
};

const urlLine = /^distributionUrl=https\\:\/\/services\.gradle\.org\/distributions\/gradle-[0-9][0-9A-Za-z.-]*-(?:bin|all)\.zip$/gm;
const sumLine = /^distributionSha256Sum=[^\r\n]*(?:\r?\n)?/gm;

function pinWrapper(text, pin = gradle) {
  const urls = text.match(urlLine) ?? [];
  if (urls.length !== 1) {
    throw new Error(
      `gradle-wrapper.properties holds ${urls.length} distributionUrl lines of the form distributionUrl=https\\://services.gradle.org/distributions/gradle-<version>-bin.zip, expected one; update plugins/with-gradle-wrapper.js for the new Expo template`,
    );
  }
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return text
    .replace(sumLine, '')
    .replace(
      urlLine,
      `distributionUrl=https\\://services.gradle.org/distributions/gradle-${pin.version}-bin.zip${eol}distributionSha256Sum=${pin.sha256}`,
    );
}

function withGradleWrapper(config) {
  return withDangerousMod(config, [
    'android',
    async (current) => {
      const file = join(current.modRequest.platformProjectRoot, 'gradle/wrapper/gradle-wrapper.properties');
      if (!existsSync(file)) {
        throw new Error(`Gradle wrapper not found at ${file}; expo prebuild no longer writes it, update plugins/with-gradle-wrapper.js`);
      }
      writeFileSync(file, pinWrapper(readFileSync(file, 'utf8')));
      return current;
    },
  ]);
}

module.exports = withGradleWrapper;
module.exports.gradle = gradle;
module.exports.pinWrapper = pinWrapper;
