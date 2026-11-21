const { withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const { copyFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const target = 'KaitechBroadcast';
const sources = ['SampleHandler.swift'];

function ids(config) {
  const bundle = config.ios?.bundleIdentifier;
  if (!bundle) throw new Error('ios.bundleIdentifier is required for the screen broadcast extension');
  return { group: `group.${bundle}`, extension: `${bundle}.broadcast` };
}

function infoPlist(config, group) {
  const version = config.version ?? '1.0.0';
  const build = config.ios?.buildNumber ?? '1';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>${config.name}</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>${version}</string>
  <key>CFBundleVersion</key>
  <string>${build}</string>
  <key>RTCAppGroupIdentifier</key>
  <string>${group}</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.broadcast-services-upload</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).SampleHandler</string>
    <key>RPBroadcastProcessMode</key>
    <string>RPBroadcastProcessModeSampleBuffer</string>
  </dict>
</dict>
</plist>
`;
}

function entitlements(group) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${group}</string>
  </array>
</dict>
</plist>
`;
}

function withFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (current) => {
      const { group } = ids(current);
      const folder = join(current.modRequest.platformProjectRoot, target);
      mkdirSync(folder, { recursive: true });
      for (const file of sources) copyFileSync(join(__dirname, 'broadcast-extension', file), join(folder, file));
      writeFileSync(join(folder, 'Info.plist'), infoPlist(current, group));
      writeFileSync(join(folder, `${target}.entitlements`), entitlements(group));
      return current;
    },
  ]);
}

function withTarget(config) {
  return withXcodeProject(config, (current) => {
    const project = current.modResults;
    if (project.pbxTargetByName(target)) return current;
    const { extension } = ids(current);
    const objects = project.hash.project.objects;
    objects.PBXTargetDependency = objects.PBXTargetDependency ?? {};
    objects.PBXContainerItemProxy = objects.PBXContainerItemProxy ?? {};
    const files = [...sources, 'Info.plist', `${target}.entitlements`];
    const group = project.addPbxGroup(files, target, target);
    const main = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup(group.uuid, main);
    const created = project.addTarget(target, 'app_extension', target, extension);
    project.addBuildPhase(sources, 'PBXSourcesBuildPhase', 'Sources', created.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', created.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', created.uuid);
    embedBeforeScripts(project);
    const deployment = current.ios?.deploymentTarget ?? '16.4';
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const settings = configurations[key].buildSettings;
      if (!settings || settings.PRODUCT_NAME !== `"${target}"`) continue;
      Object.assign(settings, {
        INFOPLIST_FILE: `${target}/Info.plist`,
        CODE_SIGN_ENTITLEMENTS: `${target}/${target}.entitlements`,
        CODE_SIGN_STYLE: 'Automatic',
        IPHONEOS_DEPLOYMENT_TARGET: deployment,
        SWIFT_VERSION: '5.0',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        CLANG_ENABLE_MODULES: 'YES',
        GENERATE_INFOPLIST_FILE: 'NO',
      });
    }
    return current;
  });
}

function embedBeforeScripts(project) {
  const app = project.getFirstTarget().firstTarget;
  const copies = project.hash.project.objects.PBXCopyFilesBuildPhase ?? {};
  const embed = app.buildPhases.find((phase) => copies[phase.value]?.dstSubfolderSpec === 13);
  const resources = app.buildPhases.findIndex((phase) => phase.comment === 'Resources');
  if (!embed || resources === -1) return;
  app.buildPhases.splice(app.buildPhases.indexOf(embed), 1);
  app.buildPhases.splice(resources + 1, 0, embed);
}

module.exports = function withBroadcastExtension(config) {
  config = withInfoPlist(config, (current) => {
    const { group, extension } = ids(current);
    current.modResults.RTCAppGroupIdentifier = group;
    current.modResults.RTCScreenSharingExtension = extension;
    return current;
  });
  config = withEntitlementsPlist(config, (current) => {
    const { group } = ids(current);
    const groups = current.modResults['com.apple.security.application-groups'] ?? [];
    if (!groups.includes(group)) current.modResults['com.apple.security.application-groups'] = [...groups, group];
    return current;
  });
  config = withFiles(config);
  return withTarget(config);
};
