import { useColorScheme } from 'react-native';

export const AVATAR_COLORS = ['#0A84FF', '#FF9500', '#34C759', '#AF52DE', '#FF2D55', '#A2845E'];

export type Theme = ReturnType<typeof useTheme>;

const light = {
  dark: false,
  bg: '#FFFFFF',
  groupedBg: '#F2F2F7',
  nav: '#F7F7F7',
  label: '#000000',
  label2: 'rgba(60,60,67,0.6)',
  label3: 'rgba(60,60,67,0.3)',
  separator: 'rgba(60,60,67,0.18)',
  fill: 'rgba(118,118,128,0.12)',
  incoming: '#E9E9EB',
  incomingText: '#000000',
  outgoing: '#0A7CFF',
  outgoingText: '#FFFFFF',
  blue: '#007AFF',
  danger: '#FF3B30',
  card: '#FFFFFF',
};

const dark: typeof light = {
  dark: true,
  bg: '#000000',
  groupedBg: '#000000',
  nav: '#1C1C1E',
  label: '#FFFFFF',
  label2: 'rgba(235,235,245,0.6)',
  label3: 'rgba(235,235,245,0.3)',
  separator: 'rgba(84,84,88,0.65)',
  fill: 'rgba(118,118,128,0.24)',
  incoming: '#26262A',
  incomingText: '#FFFFFF',
  outgoing: '#0A7CFF',
  outgoingText: '#FFFFFF',
  blue: '#0A84FF',
  danger: '#FF453A',
  card: '#1C1C1E',
};

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}
