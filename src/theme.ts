import { StyleSheet } from 'react-native';

export const colors = {
  background: '#f9f9f9',
  surface: '#ffffff',
  subtle: '#f3f3f3',
  line: '#cfc4c5',
  muted: '#5d5f5f',
  ink: '#000000',
  inverse: '#ffffff',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  margin: 20,
};

export const type = StyleSheet.create({
  display: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1.8,
    lineHeight: 52,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
});
