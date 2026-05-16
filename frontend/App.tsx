import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StatusBar } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { ArtifactDetailScreen } from './src/screens/ArtifactDetailScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MainTabs } from './src/screens/MainTabs';
import { wsClient } from './src/utils/websocket';
import { useAuthStore } from './src/store/authStore';
import { Role } from './src/utils/types';

const Stack = createNativeStackNavigator();

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentRole, setCurrentRole] = useState<Role>(Role.DEV);
  const [showLogin, setShowLogin] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { login, register, token } = useAuthStore();

  useEffect(() => {
    const storedToken = useAuthStore.getState().token;
    const storedUser = useAuthStore.getState().user;
    if (storedToken && storedUser) {
      const IS_DEV = typeof __DEV__ === 'undefined'
        ? ((globalThis as any)?.process?.env?.NODE_ENV !== 'production')
        : __DEV__;
      const API_BASE = IS_DEV ? 'http://localhost:8000' : 'https://splice-api.*****.com';
      fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => {
          if (res.ok) {
            setCurrentUser(storedUser.username);
            setCurrentRole(storedUser.role as Role);
            setShowLogin(false);
          } else {
            useAuthStore.getState().logout();
          }
        })
        .catch(() => {
          useAuthStore.getState().logout();
        });
    }
  }, []);

  const handleLogin = async (username: string, password: string, role: Role, mode: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await register(username, password, username, role);
    } catch (e: any) {
      try {
        await login(username, password);
      } catch (e2: any) {
        setAuthError(e?.message || 'Login failed');
        setAuthLoading(false);
        return;
      }
    }
    setCurrentUser(username);
    setCurrentRole(role);
    setShowLogin(false);
    setAuthLoading(false);
  };

  useEffect(() => {
    if (currentUser && token) {
      wsClient.connect(currentUser, token);
    }
    return () => {
      wsClient.disconnect();
    };
  }, [currentUser, token]);

  if (showLogin) {
    return <LoginScreen onLogin={handleLogin} loading={authLoading} error={authError} />;
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="Main">
            {(props) => <MainTabs {...props} currentUser={currentUser} />}
          </Stack.Screen>
          <Stack.Screen name="ArtifactDetail">
            {(props) => (
              <ArtifactDetailScreen
                route={props.route as any}
                navigation={props.navigation}
                currentUser={currentUser}
                currentRole={currentRole}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default App;
