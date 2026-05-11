import { useWindowDimensions, Platform } from 'react-native';

export const BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
  desktop: 1280,
};

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  return {
    width,
    height,
    isMobile: width < BREAKPOINTS.mobile,
    isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
    isDesktop: width >= BREAKPOINTS.tablet,
    isWide: width >= BREAKPOINTS.desktop,
    columns: width >= BREAKPOINTS.desktop ? 2 : 1,
    contentWidth: Math.min(width - 48, 800),
    sidePadding: Math.max(16, (width - 800) / 2),
  };
}

export const isWeb = Platform.OS === 'web';
export const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
