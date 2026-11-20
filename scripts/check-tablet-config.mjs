import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const failures = [];
const expect = (ok, message) => {
  if (!ok) failures.push(message);
};

const expo = JSON.parse(
  execFileSync('npx', ['expo', 'config', '--json', '--type', 'public'], { encoding: 'utf8' }),
);
expect(
  expo.orientation === undefined || expo.orientation === 'default',
  `expo.orientation is "${expo.orientation}"; it must be "default" so phones and tablets rotate`,
);
expect(expo.ios?.supportsTablet === true, 'expo.ios.supportsTablet must be true');
expect(expo.ios?.requireFullScreen !== true, 'expo.ios.requireFullScreen must not be true: it disables iPad Split View and Slide Over');

execFileSync('npx', ['expo', 'prebuild', '--no-install', '--platform', 'all'], { stdio: 'inherit' });

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
expect(!/resizeableActivity="false"/.test(manifest), 'AndroidManifest.xml sets android:resizeableActivity="false": multi-window is off');
const mainActivity = manifest.match(/<activity[^>]*android:name="\.MainActivity"[^>]*>/)?.[0] ?? '';
expect(mainActivity !== '', 'AndroidManifest.xml has no .MainActivity');
const androidOrientation = mainActivity.match(/android:screenOrientation="([^"]*)"/)?.[1] ?? 'unspecified';
expect(
  ['unspecified', 'user', 'fullUser', 'sensor', 'fullSensor'].includes(androidOrientation),
  `MainActivity android:screenOrientation is "${androidOrientation}": the screen is locked`,
);

const plist = readFileSync('ios/Kaitech/Info.plist', 'utf8');
expect(!/<key>UIRequiresFullScreen<\/key>\s*<true\/>/.test(plist), 'Info.plist sets UIRequiresFullScreen to true');
const ipad = plist.match(/<key>UISupportedInterfaceOrientations~ipad<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? '';
for (const orientation of ['Portrait', 'PortraitUpsideDown', 'LandscapeLeft', 'LandscapeRight']) {
  expect(
    ipad.includes(`<string>UIInterfaceOrientation${orientation}</string>`),
    `Info.plist UISupportedInterfaceOrientations~ipad lacks UIInterfaceOrientation${orientation}`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`::error::${failure}`);
  process.exit(1);
}
console.log('Tablet config: orientation follows the device, iPad multitasking and Android multi-window are on.');
