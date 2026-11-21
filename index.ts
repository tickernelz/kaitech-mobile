import { AppRegistry } from 'react-native';
import { registerHeadlessTask } from './src/features/call/decline';
import { registerMessageTask } from './src/features/chat/notify';
import './src/features/mom/uploads';

registerHeadlessTask();
registerMessageTask();
AppRegistry.registerComponent('KaitechBubble', () => require('./src/features/chat/BubbleRoot').BubbleRoot);

import 'expo-router/entry';
