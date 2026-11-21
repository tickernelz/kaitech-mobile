#!/usr/bin/env python3
"""Checks that the APK and IPA in a release rotate, allow multi-window, and run full-size on iPad."""
import glob
import os
import plistlib
import re
import subprocess
import sys
import zipfile

ANDROID = 'http://schemas.android.com/apk/res/android:'
UNLOCKED_ORIENTATIONS = {-1, 2, 4, 10, 13}
IPHONE_ORIENTATIONS = {'Portrait', 'LandscapeLeft', 'LandscapeRight'}
IPAD_ORIENTATIONS = IPHONE_ORIENTATIONS | {'PortraitUpsideDown'}


def aapt2():
    tools = glob.glob(os.path.join(os.environ.get('ANDROID_HOME', ''), 'build-tools', '*', 'aapt2'))
    if not tools:
        sys.exit('aapt2 not found under $ANDROID_HOME/build-tools')
    return max(tools, key=lambda path: [int(part) for part in re.findall(r'\d+', os.path.basename(os.path.dirname(path)))])


def manifest_elements(apk):
    tree = subprocess.run(
        [aapt2(), 'dump', 'xmltree', '--file', 'AndroidManifest.xml', apk],
        check=True, capture_output=True, text=True,
    ).stdout
    elements = []
    for line in tree.splitlines():
        element = re.match(r'\s*E: (\S+)', line)
        if element:
            elements.append((element.group(1), {}))
            continue
        attribute = re.match(r'\s*A: ' + re.escape(ANDROID) + r'(\w+)\([^)]*\)=(?:"([^"]*)"|(\S+))', line)
        if attribute and elements:
            elements[-1][1][attribute.group(1)] = attribute.group(2) if attribute.group(2) is not None else attribute.group(3)
    return elements


def check_apk(apk):
    failures = []
    elements = manifest_elements(apk)
    application = next((attrs for name, attrs in elements if name == 'application'), {})
    main = next((attrs for name, attrs in elements if name == 'activity' and attrs.get('name', '').endswith('.MainActivity')), None)
    if main is None:
        return [f'{apk}: no MainActivity in AndroidManifest.xml']
    for owner, attrs in (('application', application), ('MainActivity', main)):
        if attrs.get('resizeableActivity', '').lower() in ('false', '0x0', '0'):
            failures.append(f'{apk}: {owner} sets android:resizeableActivity=false, multi-window is off')
    orientation = int(main.get('screenOrientation', '-1'), 0)
    if orientation not in UNLOCKED_ORIENTATIONS:
        failures.append(f'{apk}: MainActivity android:screenOrientation={orientation}, the screen is locked')
    return failures


def check_ipa(ipa):
    with zipfile.ZipFile(ipa) as archive:
        name = next((n for n in archive.namelist() if re.fullmatch(r'Payload/[^/]+\.app/Info\.plist', n)), None)
        if name is None:
            return [f'{ipa}: no Payload/*.app/Info.plist']
        plist = plistlib.loads(archive.read(name))
    failures = []
    if 2 not in plist.get('UIDeviceFamily', []):
        failures.append(f'{ipa}: UIDeviceFamily lacks 2, the app runs scaled up on iPad')
    if plist.get('UIRequiresFullScreen') is True:
        failures.append(f'{ipa}: UIRequiresFullScreen is true, iPad Split View and Slide Over are off')
    for key, wanted in (('UISupportedInterfaceOrientations', IPHONE_ORIENTATIONS), ('UISupportedInterfaceOrientations~ipad', IPAD_ORIENTATIONS)):
        have = {value.removeprefix('UIInterfaceOrientation') for value in plist.get(key, [])}
        if not wanted <= have:
            failures.append(f'{ipa}: {key} lacks {", ".join(sorted(wanted - have))}')
    return failures


def main(paths):
    if not paths:
        sys.exit('usage: check-release-artifacts.py <apk|ipa>...')
    failures = []
    for path in paths:
        if path.endswith('.apk'):
            failures += check_apk(path)
        elif path.endswith('.ipa'):
            failures += check_ipa(path)
        else:
            failures.append(f'{path}: neither .apk nor .ipa')
    for failure in failures:
        print(f'::error::{failure}')
    if failures:
        sys.exit(1)
    print(f'Release config: {len(paths)} artifact(s) rotate, allow multi-window and run full-size on iPad.')


main(sys.argv[1:])
