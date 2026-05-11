import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';

export type TabKey = 'home' | 'activity' | 'teams';

interface Tab {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { key: 'home', label: 'Artifacts', icon: '◐' },
  { key: 'activity', label: 'Activity', icon: '⟳' },
  { key: 'teams', label: 'Teams', icon: '◎' },
];

interface TabBarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  badge?: number;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange, badge }) => {
  const { width } = useWindowDimensions();
  const tabWidth = Math.min((width - 24) / TABS.length, 120);
  const indicatorAnim = useRef(new Animated.Value(TABS.findIndex(t => t.key === activeTab))).current;

  const handlePress = (tab: TabKey) => {
    const idx = TABS.findIndex(t => t.key === tab);
    Animated.spring(indicatorAnim, {
      toValue: idx,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start();
    onTabChange(tab);
  };

  const indicatorTranslate = indicatorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, tabWidth, tabWidth * 2],
  });

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.indicator,
            {
              width: tabWidth - 16,
              transform: [{ translateX: indicatorTranslate }],
            },
          ]}
        />
        {TABS.map((tab, i) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, { width: tabWidth }]}
              onPress={() => handlePress(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {tab.key === 'activity' && badge && badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A0A0F',
    borderTopWidth: 1,
    borderTopColor: '#1C1C2E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: '#14141E',
    borderRadius: 16,
    padding: 6,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 6,
    height: '100%',
    backgroundColor: '#1C1C2E',
    borderRadius: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    position: 'relative',
  },
  tabIcon: {
    fontSize: 14,
    color: '#3A3A50',
  },
  tabIconActive: {
    color: '#7C5CFC',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A50',
  },
  tabLabelActive: {
    color: '#9E9EB8',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 4,
    backgroundColor: '#FF4757',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
