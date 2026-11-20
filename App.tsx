import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { deviceLocaleTag, resolveLanguage, stringsFor } from './src/i18n/language';

const strings = stringsFor(resolveLanguage(deviceLocaleTag()));

export default function App() {
  return (
    <View style={styles.container} testID="app-root">
      <Text style={styles.title}>{strings.app.name}</Text>
      <Text style={styles.greeting} testID="app-greeting">
        {strings.app.greeting}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#0f172a',
  },
  greeting: {
    fontSize: 17,
    color: '#475569',
  },
});
