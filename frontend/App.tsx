import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './src/screens/HomeScreen';
import { ArtifactDetailScreen } from './src/screens/ArtifactDetailScreen';
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

  const handleLogin = async (username: string, role: Role) => {
    setAuthLoading(true);
    setAuthError(null);
    const password = username + '_splice_2024';
    let lastError = '';
    try {
      await register(username, password, username, role);
    } catch (e: any) {
      lastError = e?.message || 'Registration failed';
      try {
        await login(username, password);
      } catch (e2: any) {
        setAuthError(lastError);
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
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home">
            {(props) => <HomeScreen {...props} currentUser={currentUser} />}
          </Stack.Screen>
          <Stack.Screen name="ArtifactDetail">
            {(props) => (
              <ArtifactDetailScreen
                {...props}
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

interface LoginScreenProps {
  onLogin: (username: string, role: Role) => void;
  loading: boolean;
  error: string | null;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, loading, error }) => {
  const [username, setUsername] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>(Role.DEV);

  const roles = [
    { value: Role.DEV, label: 'Developer' },
    { value: Role.DESIGNER, label: 'Designer' },
    { value: Role.PM, label: 'PM' },
    { value: Role.BACKEND, label: 'Backend' },
    { value: Role.FRONTEND, label: 'Frontend' },
  ];

  return (
    <View style={loginStyles.container}>
      <View style={loginStyles.illustrationArea}>
        <View style={loginStyles.orbLarge} />
        <View style={loginStyles.orbSmall} />
        <View style={loginStyles.orbCyan} />
        <View style={loginStyles.node1} />
        <View style={loginStyles.node2} />
        <View style={loginStyles.node3} />
        <View style={loginStyles.node4} />
        <View style={[loginStyles.connector, { transform: [{ rotate: '30deg' }] }]} />
        <View style={[loginStyles.connector, { transform: [{ rotate: '120deg' }] }]} />
        <View style={[loginStyles.connector, { transform: [{ rotate: '250deg' }] }]} />
        <Text style={loginStyles.logo}>Splice</Text>
        <Text style={loginStyles.subtitle}>where teams connect</Text>
      </View>

      <View style={loginStyles.card}>
        <Text style={loginStyles.formLabel}>Username</Text>
        <TextInput
          style={loginStyles.input}
          placeholder="e.g. alice_dev"
          placeholderTextColor="#3A3A50"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <Text style={loginStyles.formLabel}>Role</Text>
        {roles.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[
              loginStyles.roleOption,
              selectedRole === r.value && loginStyles.roleOptionActive,
            ]}
            onPress={() => setSelectedRole(r.value)}
          >
            <View style={[loginStyles.roleDot, { backgroundColor: selectedRole === r.value ? '#FFFFFF' : '#3A3A50' }]} />
            <Text
              style={[
                loginStyles.roleText,
                selectedRole === r.value && loginStyles.roleTextActive,
              ]}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}

        {error && (
          <Text style={loginStyles.errorText}>{error}</Text>
        )}

        <TouchableOpacity
          style={[loginStyles.loginBtn, (!username.trim() || loading) && loginStyles.loginBtnDisabled]}
          onPress={() => onLogin(username.trim(), selectedRole)}
          disabled={!username.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={loginStyles.loginBtnText}>Enter</Text>
          )}
        </TouchableOpacity>

        <Text style={loginStyles.hint}>
          pick a name and role — no password needed
        </Text>
      </View>
    </View>
  );
};

const loginStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    padding: 24,
  },
  illustrationArea: {
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
    height: 180,
    justifyContent: 'center',
  },
  orbLarge: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#7C5CFC',
    opacity: 0.12,
    top: -20,
    right: -20,
  },
  orbSmall: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF6B9D',
    opacity: 0.1,
    bottom: 0,
    left: -10,
  },
  orbCyan: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00D4FF',
    opacity: 0.08,
    top: 10,
    left: 30,
  },
  node1: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#7C5CFC',
    top: 20,
    right: 60,
  },
  node2: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00F5A0',
    top: 50,
    left: 40,
  },
  node3: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B9D',
    bottom: 30,
    right: 40,
  },
  node4: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFB347',
    bottom: 40,
    left: 70,
  },
  connector: {
    position: 'absolute',
    width: 60,
    height: 1,
    backgroundColor: '#2A2A40',
    top: 80,
    left: 50,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 13,
    color: '#5C5C78',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#14141E',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C5C78',
    marginBottom: 8,
    marginTop: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#2A2A40',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#1C1C2E',
    color: '#FFFFFF',
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A40',
    marginBottom: 8,
    backgroundColor: '#1C1C2E',
  },
  roleOptionActive: {
    backgroundColor: '#7C5CFC',
    borderColor: '#7C5CFC',
  },
  roleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 15,
    color: '#9E9EB8',
    fontWeight: '600',
  },
  roleTextActive: {
    color: '#FFFFFF',
  },
  loginBtn: {
    backgroundColor: '#7C5CFC',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  loginBtnDisabled: {
    backgroundColor: '#2A2A40',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 13,
    color: '#FF4757',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: -8,
  },
  hint: {
    fontSize: 11,
    color: '#3A3A50',
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 0.3,
  },
});

export default App;
