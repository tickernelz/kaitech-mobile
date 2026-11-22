import { FloatingActionButton, RNHostView } from '@expo/ui/jetpack-compose';
import { semantics, testID as tag } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet } from 'react-native';
import { space, useTheme } from '../theme';
import { Icon, type IconName } from './icons';
import { MaterialHost } from './MaterialHost';

export function Fab({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const { material } = useTheme();
  return (
    <MaterialHost matchContents style={styles.fab}>
      <FloatingActionButton
        containerColor={material.primary}
        onClick={onPress}
        modifiers={[...(testID ? [tag(testID)] : []), semantics({ contentDescription: label })]}>
        <FloatingActionButton.Icon>
          <RNHostView matchContents>
            <Icon name={icon} color={material.onPrimary} />
          </RNHostView>
        </FloatingActionButton.Icon>
      </FloatingActionButton>
    </MaterialHost>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: space.lg, bottom: space.lg },
});
