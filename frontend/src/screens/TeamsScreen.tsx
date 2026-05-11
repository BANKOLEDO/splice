import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { BREAKPOINTS } from '../utils/responsive';

export const TeamsScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.tablet;
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setToken = useAuthStore((s) => s.setToken);
  const [teams, setTeams] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinId, setJoinId] = useState('');

  const fetchTeams = useCallback(async () => {
    try {
      const data = await api.getTeams();
      setTeams(data);
      const memberMap: Record<string, any[]> = {};
      await Promise.all(data.map(async (t: any) => {
        try {
          memberMap[t.id] = await api.getTeamMembers(t.id);
        } catch { memberMap[t.id] = []; }
      }));
      setMembers(memberMap);
    } catch (e) {
      console.warn('Failed to fetch teams:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const slug = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const result = await api.createTeam({ name: newName.trim(), slug });
      if (user && token) {
        setToken(token, { ...user, team_id: result.id });
      }
      setShowCreate(false);
      setNewName('');
      fetchTeams();
    } catch (e) {
      console.warn('Failed to create team:', e);
    }
  };

  const handleJoin = async () => {
    if (!joinId.trim()) return;
    try {
      await api.joinTeam(joinId.trim());
      if (user && token) {
        setToken(token, { ...user, team_id: joinId.trim() });
      }
      setShowJoin(false);
      setJoinId('');
      fetchTeams();
    } catch (e) {
      console.warn('Failed to join team:', e);
    }
  };

  const handleSwitch = (t: any) => {
    if (user && token) {
      setToken(token, { ...user, team_id: t.id });
    }
  };

  const handleDelete = (t: any) => {
    Alert.alert(
      'Delete Team',
      `Are you sure you want to delete "${t.name}"? All artifacts in this team will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteTeam(t.id);
              if (user?.team_id === t.id && user && token) {
                const remaining = teams.filter((x: any) => x.id !== t.id);
                const nextTeam = remaining[0];
                if (nextTeam) {
                  setToken(token, { ...user, team_id: nextTeam.id });
                } else {
                  setToken(token, { ...user, team_id: undefined });
                }
              }
              fetchTeams();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete team');
            }
          },
        },
      ],
    );
  };

  const renderTeam = ({ item }: { item: any }) => {
    const teamMembers = members[item.id] || [];
    const isActive = item.id === user?.team_id;
    const isCreator = item.created_by === user?.id;
    return (
      <View style={[styles.teamCard, isActive && styles.teamCardActive]}>
        <TouchableOpacity onPress={() => handleSwitch(item)} activeOpacity={0.7}>
        <View style={styles.teamHeader}>
          <View style={[styles.teamIcon, isActive && styles.teamIconActive]}>
            <Text style={styles.teamIconText}>◎</Text>
          </View>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{item.name}</Text>
            <Text style={styles.teamSlug}>/{item.slug}</Text>
          </View>
          {isActive && (
            <View style={styles.activeIndicator}>
              <Text style={styles.activeDot}>✓</Text>
            </View>
          )}
        </View>
        {teamMembers.length > 0 && (
          <View style={styles.memberRow}>
            {teamMembers.slice(0, 5).map((m: any, i: number) => (
              <View key={m.id || i} style={styles.memberChip}>
                <Text style={styles.memberName}>{m.display_name || m.username}</Text>
              </View>
            ))}
            {teamMembers.length > 5 && (
              <Text style={styles.moreMembers}>+{teamMembers.length - 5}</Text>
            )}
          </View>
        )}
        </TouchableOpacity>
        {isCreator && (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.wrap, isDesktop && styles.wrapDesktop]}>
        <View style={styles.headerArea}>
          <Text style={styles.headerTitle}>Teams</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowJoin(true)}>
              <Text style={styles.actionText}>Join</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => setShowCreate(true)}>
              <Text style={styles.actionTextPrimary}>+ Create</Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={loading ? [] : teams}
          keyExtractor={(item) => item.id}
          renderItem={renderTeam}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTeams(); }} tintColor="#7C5CFC" />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <Modal visible={showCreate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create Team</Text>
            <TextInput
              style={styles.input}
              placeholder="Team name"
              placeholderTextColor="#3A3A50"
              value={newName}
              onChangeText={setNewName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showJoin} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Join Team</Text>
            <TextInput
              style={styles.input}
              placeholder="Team ID"
              placeholderTextColor="#3A3A50"
              value={joinId}
              onChangeText={setJoinId}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowJoin(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleJoin}>
                <Text style={styles.createText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  wrap: {
    flex: 1,
    width: '100%',
  },
  wrapDesktop: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  headerArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#0A0A0F',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C2E',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1C1C2E',
  },
  actionText: {
    fontSize: 13,
    color: '#5C5C78',
    fontWeight: '600',
  },
  actionBtnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#7C5CFC',
  },
  actionTextPrimary: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  teamCard: {
    backgroundColor: '#14141E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1C1C2E',
  },
  teamCardActive: {
    borderColor: '#7C5CFC',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0D0D1A',
    borderWidth: 1,
    borderColor: '#1C1C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamIconActive: {
    backgroundColor: 'rgba(124,92,252,0.15)',
    borderColor: '#7C5CFC',
  },
  teamIconText: {
    fontSize: 16,
    color: '#5C5C78',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  teamSlug: {
    fontSize: 12,
    color: '#3A3A50',
    marginTop: 1,
  },
  activeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7C5CFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDot: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  memberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1C1C2E',
  },
  memberChip: {
    backgroundColor: '#0D0D1A',
    borderWidth: 1,
    borderColor: '#1C1C2E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  memberName: {
    fontSize: 11,
    color: '#5C5C78',
    fontWeight: '600',
  },
  moreMembers: {
    fontSize: 11,
    color: '#3A3A50',
    fontWeight: '600',
    alignSelf: 'center',
  },
  deleteBtn: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1C1C2E',
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 12,
    color: '#FF4757',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#14141E',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1C1C2E',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#1C1C2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: '#0D0D1A',
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1C1C2E',
  },
  cancelText: {
    fontSize: 14,
    color: '#5C5C78',
    fontWeight: '600',
  },
  createBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#7C5CFC',
  },
  createText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
