This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building

APK and IPA are built only in GitHub Actions (`.github/workflows/e2e.yml` for the E2E APK and iOS simulator app, `.github/workflows/release.yml` for release artifacts). Do not use EAS Build, EAS Submit, or EAS Update. There are no store accounts yet: the APK is signed with a non-store keystore from GitHub Secrets, the IPA is unsigned.

Never commit secrets, server addresses, client data, or credential files. Sign-in defaults to the link host server and the `KAITECH_DEFAULT_DB` database, both read from repo variables at build time; users who need another server enter its address and database.

E2E flows live in `.maestro/` and run on an Android emulator and an iPhone simulator in GitHub Actions (`docs/ci.md`).

## Releases

Every release ships a changelog, in two places: `docs/changelog.md` and the body of its GitHub Release page.

- The pull request that raises `version` in `app.json` also adds the section `## X.Y.Z - YYYY-MM-DD` at the top of `docs/changelog.md`: the groups Added, Changed, Fixed and Known gaps, every line naming its pull request and ZHA task. A version bump without its section is not ready for review.
- `release.yml` copies that section into the GitHub Release body (`scripts/changelog-section.sh`) and fails in its first job when the tag `vX.Y.Z` has no `## X.Y.Z` section, so a release without a changelog is never published.
- Write only what a pull request, tag or release run shows. What cannot be traced is written as unknown, never guessed. A correction to a published section goes through a pull request to `docs/changelog.md`, then `gh release edit` copies it to the release page.
- Steps: `docs/releases.md`.

## CI/CD & Testing Rules

These rules bind every agent and contributor on every change. `docs/ci.md` describes the pipeline.

- **Testing pyramid.** Business logic, LiveKit call state, validation, and translation parity are tested with unit and component tests (Jest, `@testing-library/react-native`, `npm run i18n:check`). E2E covers critical user journeys only. Never add locale or screen-size variants to the pull request E2E run; the full matrix runs nightly.
- **Fast PR gate.** `ci.yml` is the only required check set (`gitleaks diff`, `lint`, `typecheck`, `unit`). It stays under 3 minutes and deterministic on `ubuntu-latest`. Never add an emulator or simulator job, a native build, or a full-history scan to it; full-history gitleaks belongs to `release.yml`.
- **Native vs JS separation.** A change under `src/` must not rebuild native code in CI when the native fingerprint (`@expo/fingerprint`, `fingerprint.config.js`) is unchanged: E2E repacks the cached native build with the new JS bundle. Changes to `modules/kaitech-call/`, `plugins/`, `app.config.ts`, `app.json`, `patches/`, or native dependencies must change the fingerprint; a new native source location goes into `fingerprint.config.js` in the same pull request.
- **Workflow hygiene.** Keep exactly three workflow files: `ci.yml`, `e2e.yml`, `release.yml`; shared steps go into composite actions under `.github/actions/`. Use GitHub-hosted standard runners only (`ubuntu-latest`, and a pinned macOS version, now `macos-26`; never `macos-latest`). Move the macOS pin only when the Expo SDK needs a newer Xcode, with the failing build as evidence. Every workflow has `concurrency` that cancels superseded pull request runs, every job has `timeout-minutes`, docs-only changes skip CI (`paths-ignore` on push; on pull requests the required jobs report skipped so branch protection still passes), and third-party actions are pinned to a commit SHA.
- **Job names.** A job with `if:` or `needs:` never uses `matrix.*` in `name:`: GitHub shows a skipped job's name template unevaluated (`android rows ${{ matrix.size }}`). Give it a constant name and let GitHub append the matrix values (`android rows (phone, en-US, hide-direct)`); GitHub omits a key that `include` merges into an existing combination, so list such cells in `include`. Keep matrix values to what identifies the cell; derive profiles, ABIs and artifact names from them.
- **Caches.** Caches are written only from `refs/heads/main` (push, schedule, dispatch on `main`); pull requests, other branches and tags only read them, so a new save step is guarded by `env.SAVE_CACHES` and every job reports hit or miss in its run summary (`scripts/cache-summary.sh`).
- **E2E triggers.** E2E runs on merges to `main` (smoke), on pull requests labelled `run-e2e` (smoke), nightly (full), and on manual dispatch. Its `ios ipa size` job builds the Release IPA for the size gate on pull requests that change native or bundler inputs or carry `measure-ios`, nightly, and on `full` dispatches. A feature branch proves itself with a dispatch in `android` mode (Android matrix and signed-in rows, no iOS); the iOS proof comes from `full` on `main` (nightly or dispatched). None of these is a merge requirement: a pull request merges on the four required checks green at its exact SHA, the reviewer's approval of that SHA, and the E2E flows of the changed journey run on a physical phone with the result attached to the task (`docs/e2e.md`, Physical phone); a red E2E run is a finding, not a blocker. The `run-e2e` label and dispatches stay available for native or wide changes; heavy suites, videos and screenshots otherwise run in GitHub Actions, not on a local emulator.
- **Pre-PR verification.** Before opening or updating a pull request run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run i18n:check` locally; for changed workflows also `actionlint`, for changed flows `maestro check-syntax`.
- **E2E roadmap.** Use `.maestro/` flows with `maestro-runner` (Maestro CLI where `docs/ci.md` names it). When a scenario needs more than Maestro can drive, such as multi-device WebRTC calls or full control over OS permission dialogs, write it with Appium and WebdriverIO in TypeScript instead of stretching Maestro.

## Documentation

- Write all repo documentation, README included, in English.
- All documentation lives in `docs/`, indexed by `docs/README.md`. Do not add documentation anywhere else.
- `README.md` is only a summary: the banner (`docs/assets/banner.svg`), one paragraph about the app, key facts, install links, a link to `docs/README.md`, and the license. No technical detail there.
- A new feature or a change in behaviour updates the matching `docs/` page in the same PR.
- App display text (`src/i18n/locales/en.json`, `id.json`, and the other catalogue pairs under `src/i18n/`) is not documentation and stays in both languages.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or the CI build.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
