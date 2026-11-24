import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Alert, Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react…[+9]
import { AccessibilityInfo, Platform, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import Animated from 'react-native-reanimated';
import { ScreenCapturePickerView } from '@livekit/react-native-webrtc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layoutFor, pagesFor, presenterOf, stageFor, stageView, tileGap } from '../grid';
import { screenShareSupported, setBroadcastPicker } from '../screenShare';
import { useTheme, space } from '../../../theme';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/icons';
import { Avatar } from '../../chat/ui/Avatar';
import {
import { conversationById, getChat } from '../../chat/chat';
import { InviteSheet, OutputSheet } from './CallSheets';
import { usePictureInPictureAllowed } from '../pipSetting';
import { useElapsed } from '../clock';
import { blurSupported } from '../blur';
import { controlsFor, type CallAction } from '../controls';
import { CallPill, MoreSheet, RoundButton, type ControlState } from './CallControls';
import { CallTile } from './CallTile';
import { FloatingTile } from './FloatingTile';
import { ScreenStage, type PipTarget } from './ScreenStage';
import { useAutoHide } from './useAutoHide';

export function CallScreen() { ... }
function askForCamera(title: string, body: string, cancel: string, settings: string) { ... }
function FullScreenNotice() { ... }
type EndedReason = (typeof endedReasons)[number];
function recordingErrorKey(code: string): `recordingErrors.${(typeof recordingErrors)[number] | 'other'}` { ... }
function endedKey(reason: string | null): `ended.${EndedReason}` { ... }
… 409 lines summarized
[output summarized by the cat filter; pipe through `| cat` for verbatim output]
[raw output: local://7e542dba-d36e-4a68-b052-65641dbfc0a0.log]
