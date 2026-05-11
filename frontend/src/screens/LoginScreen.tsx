import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Role } from '../utils/types';
import { BREAKPOINTS } from '../utils/responsive';

interface LoginScreenProps {
  onLogin: (username: string, role: Role) => void;
  loading: boolean;
  error: string | null;
}

const roles = [
  { value: Role.DEV, label: 'Developer' },
  { value: Role.DESIGNER, label: 'Designer' },
  { value: Role.PM, label: 'PM' },
  { value: Role.BACKEND, label: 'Backend' },
  { value: Role.FRONTEND, label: 'Frontend' },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, loading, error }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.tablet;
  const [username, setUsername] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>(Role.DEV);

  return (
    <View style={styles.container}>
      <View style={[styles.innerWrap, isDesktop && styles.innerWrapDesktop]}>
        <View style={styles.illustrationArea}>
          <View style={styles.orbLarge} />
          <View style={styles.orbSmall} />
          <View style={styles.orbCyan} />
          <View style={styles.node1} />
          <View style={styles.node2} />
          <View style={styles.node3} />
          <View style={styles.node4} />
          <View style={[styles.connector, { transform: [{ rotate: '30deg' }] }]} />
          <View style={[styles.connector, { transform: [{ rotate: '120deg' }] }]} />
          <View style={[styles.connector, { transform: [{ rotate: '250deg' }] }]} />
          <Text style={styles.logo}>Splice</Text>
          <Text style={styles.subtitle}>where teams connect</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.formLabel}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. alice_dev"
            placeholderTextColor="#2A2A40"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Text style={styles.formLabel}>Role</Text>
          {roles.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[
                styles.roleOption,
                selectedRole === r.value && styles.roleOptionActive,
              ]}
              onPress={() => setSelectedRole(r.value)}
              activeOpacity={0.7}
            >
              <View style={[styles.roleDot, { backgroundColor: selectedRole === r.value ? '#FFFFFF' : '#2A2A40' }]} />
              <Text
                style={[
                  styles.roleText,
                  selectedRole === r.value && styles.roleTextActive,
                ]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.loginBtn, (!username.trim() || loading) && styles.loginBtnDisabled]}
            onPress={() => onLogin(username.trim(), selectedRole)}
            disabled={!username.trim() || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Enter</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>pick a name and role — no password needed</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 440,
  },
  innerWrapDesktop: {
    maxWidth: 420,
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
    color: '#3A3A50',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#14141E',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1C1C2E',
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
    borderColor: '#1C1C2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#0D0D1A',
    color: '#FFFFFF',
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1C1C2E',
    marginBottom: 8,
    backgroundColor: '#0D0D1A',
  },
  roleOptionActive: {
    backgroundColor: '#7C5CFC',
    borderColor: '#7C5CFC',
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleText: {
    fontSize: 14,
    color: '#5C5C78',
    fontWeight: '600',
  },
  roleTextActive: {
    color: '#FFFFFF',
  },
  loginBtn: {
    backgroundColor: '#7C5CFC',
    padding: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 20,
  },
  loginBtnDisabled: {
    backgroundColor: '#1C1C2E',
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
    color: '#2A2A40',
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 0.3,
  },
});
