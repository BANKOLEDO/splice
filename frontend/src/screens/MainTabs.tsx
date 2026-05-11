import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions, Text } from 'react-native';
import { TabBar, TabKey } from '../components/TabBar';
import { HomeScreen } from './HomeScreen';
import { ActivityScreen } from './ActivityScreen';
import { TeamsScreen } from './TeamsScreen';
import { wsClient } from '../utils/websocket';
import { useAuthStore } from '../store/authStore';

interface MainTabsProps {
  navigation: any;
  currentUser: string;
}

export const MainTabs: React.FC<MainTabsProps> = ({ navigation, currentUser }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [notifCount, setNotifCount] = useState(0);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    const unsubMsg = wsClient.on('new_message', () => {
      if (activeTab !== 'activity') {
        setNotifCount((c) => c + 1);
      }
    });
    const unsubCreated = wsClient.on('artifact_created', () => {
      if (activeTab !== 'activity') {
        setNotifCount((c) => c + 1);
      }
    });
    return () => {
      unsubMsg();
      unsubCreated();
    };
  }, [token, activeTab]);

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    if (tab === 'activity') setNotifCount(0);
  }, []);

  const handleNavigateToTeams = useCallback(() => {
    setActiveTab('teams');
  }, []);

  const handleNavigateToDetail = useCallback((artifact: any) => {
    navigation.navigate('ArtifactDetail', { artifact });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {activeTab === 'home' && (
          <HomeScreen
            navigation={navigation}
            currentUser={currentUser}
            onNavigateToTeams={handleNavigateToTeams}
          />
        )}
        {activeTab === 'activity' && (
          <ActivityScreen currentUser={currentUser} onNavigateToDetail={handleNavigateToDetail} />
        )}
        {activeTab === 'teams' && (
          <TeamsScreen />
        )}
      </View>
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} badge={notifCount} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  content: {
    flex: 1,
  },
});
