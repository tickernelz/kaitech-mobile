import { RefreshControl, type RefreshControlProps } from 'react-native';
import { useTheme } from '../theme';

const indicatorDiameter = 40;
const indicatorClearance = 8;

export const refreshIndicatorOffset = indicatorDiameter + indicatorClearance;

export function Refresh(props: RefreshControlProps) {
  const { colors } = useTheme();
  return <RefreshControl progressViewOffset={refreshIndicatorOffset} tintColor={colors.primary} colors={[colors.primary]} {...props} />;
}
