import { AppRegistry } from 'react-native';
import { registerHeadlessTask } from './src/features/call/decline';
import { registerCallKeepAlive } from './src/features/call/keepAlive';
import { registerMessageTask } from './src/features/chat/notify';
import './src/features/mom/uploads';

registerHeadlessTask();
registerCallKeepAlive();
registerMessageTask();
AppRegistry.registerComponent('KaitechBubble', () => require('./src/features/chat/BubbleRoot').BubbleRoot);

import 'expo-router/entry';
