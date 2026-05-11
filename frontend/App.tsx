import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './src/screens/HomeScreen';
import { ArtifactDetailScreen } from './src/screens/ArtifactDetailScreen';
import { wsClient } from './src/utils/websocket';
import { Role } from './src/utils/types';

const Stack = createNativeStackNavigator();

const USER_STORAGE_KEY = 'splice_user_id';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentRole, setCurrentRole] = useState<Role>(Role.DEV);
  const [showLogin, setShowLogin] = useState(true);

  const handleLogin = (username: string, role: Role) => {
    setCurrentUser(username);
    setCurrentRole(role);
    setShowLogin(false);
  };

  useEffect(() => {
    if (currentUser) {
      wsClient.connect(currentUser);
    }
    return () => {
      wsClient.disconnect();
    };
  }, [currentUser]);

  if (showLogin) {
    return <LoginScreen onLogin={handleLogin} />;
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
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
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
      <View style={loginStyles.card}>
        <Text style={loginStyles.logo}>Splice</Text>
        <Text style={loginStyles.subtitle}>Real-time team communication bridge</Text>

        <Text style={loginStyles.label}>Username</Text>
        <TextInput
          style={loginStyles.input}
          placeholder="e.g. alice_dev"
          placeholderTextColor="#999"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <Text style={loginStyles.label}>Role</Text>
        {roles.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[
              loginStyles.roleOption,
              selectedRole === r.value && loginStyles.roleOptionActive,
            ]}
            onPress={() => setSelectedRole(r.value)}
          >
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

        <TouchableOpacity
          style={[loginStyles.loginBtn, !username.trim() && loginStyles.loginBtnDisabled]}
          onPress={() => onLogin(username.trim(), selectedRole)}
          disabled={!username.trim()}
        >
          <Text style={loginStyles.loginBtnText}>Join Splice</Text>
        </TouchableOpacity>

        <Text style={loginStyles.hint}>
          No signup required. Choose a name and role to start.
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
  card: {
    backgroundColor: '#14141E',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  logo: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#5C5C78',
    textAlign: 'center',
    marginBottom: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9E9EB8',
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#2A2A40',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#1C1C2E',
    color: '#FFFFFF',
  },
  roleOption: {
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
    marginTop: 24,
  },
  loginBtnDisabled: {
    backgroundColor: '#2A2A40',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: '#5C5C78',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default App;
