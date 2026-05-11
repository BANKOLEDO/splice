import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { ArtifactCard } from '../components/ArtifactCard';
import { api } from '../utils/api';
import { Artifact, ArtifactType, ArtifactStatus, OwnerRole, TYPE_COLORS, ROLE_COLORS } from '../utils/types';
import { BREAKPOINTS } from '../utils/responsive';
import { useAuthStore } from '../store/authStore';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Spec', value: 'spec' },
  { label: 'Design', value: 'design' },
  { label: 'API', value: 'api' },
  { label: 'UI', value: 'ui' },
  { label: 'Task', value: 'task' },
  { label: 'Question', value: 'question' },
];

export const HomeScreen: React.FC<{ navigation: any; currentUser: string; onNavigateToTeams?: () => void }> = ({
  navigation,
  currentUser,
  onNavigateToTeams,
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.tablet;
  const user = useAuthStore((s) => s.user);
  const setToken = useAuthStore((s) => s.setToken);
  const token = useAuthStore((s) => s.token);
  const teamId = user?.team_id;
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [filtered, setFiltered] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [newArtifact, setNewArtifact] = useState({
    title: '',
    content: '',
    type: ArtifactType.TASK,
    owner_role: OwnerRole.DEV,
  });

  const fetchArtifacts = useCallback(async () => {
    try {
      const data = await api.getArtifacts({ limit: 100, team_id: teamId });
      setArtifacts(data);
    } catch (e) {
      console.warn('Failed to fetch artifacts:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  useEffect(() => {
    let result = artifacts;
    if (activeFilter) {
      result = result.filter((a) => a.type === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q) ||
          a.created_by.toLowerCase().includes(q),
      );
    }
    setFiltered(result);
  }, [artifacts, activeFilter, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchArtifacts();
  };

  const handleCreate = async () => {
    if (!newArtifact.title.trim()) return;
    try {
      const id = `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await api.createArtifact({
        id,
        ...newArtifact,
        team_id: teamId || '',
        status: ArtifactStatus.DRAFT,
        dependencies: [],
        created_by: currentUser,
        metadata: {},
      });
      setShowNewModal(false);
      setNewArtifact({ title: '', content: '', type: ArtifactType.TASK, owner_role: OwnerRole.DEV });
      fetchArtifacts();
    } catch (e) {
      console.warn('Failed to create artifact:', e);
    }
  };

  const renderHeader = () => (
    <View>
      <View style={styles.headerBar}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerDot} />
          <Text style={styles.headerTitle}>Splice</Text>
        </View>
        <TouchableOpacity style={styles.teamBadge} onPress={onNavigateToTeams}>
          <Text style={styles.teamBadgeIcon}>◎</Text>
          <Text style={styles.teamBadgeText} numberOfLines={1}>
            {user?.team_id?.substring(0, 8) || 'Team'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newButton} onPress={() => setShowNewModal(true)}>
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search artifacts..."
          placeholderTextColor="#2A2A40"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[
              styles.filterChip,
              activeFilter === f.value && {
                backgroundColor: f.value ? TYPE_COLORS[f.value] || '#1C1C2E' : '#1C1C2E',
                borderColor: f.value ? TYPE_COLORS[f.value] || '#1C1C2E' : '#1C1C2E',
              },
            ]}
            onPress={() => setActiveFilter(activeFilter === f.value ? '' : f.value)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === f.value && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.countText}>
        {filtered.length} artifact{filtered.length !== 1 ? 's' : ''}
        {activeFilter ? ` (${activeFilter})` : ''}
      </Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>~</Text>
      <Text style={styles.emptyText}>No artifacts yet</Text>
      <Text style={styles.emptySubtext}>Create one to get started</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.listWrap, isDesktop && styles.listWrapDesktop]}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ArtifactCard
              artifact={item}
              onPress={(art) => navigation.navigate('ArtifactDetail', { artifact: art })}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={loading ? null : renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#7C5CFC" />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <Modal visible={showNewModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Artifact</Text>
              <TouchableOpacity onPress={() => setShowNewModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Type</Text>
            <View style={styles.pillRow}>
              {Object.values(ArtifactType).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.pillOption,
                    newArtifact.type === t && { backgroundColor: TYPE_COLORS[t] || '#7C5CFC', borderColor: TYPE_COLORS[t] || '#7C5CFC' },
                  ]}
                  onPress={() => setNewArtifact({ ...newArtifact, type: t as ArtifactType })}
                >
                  <Text style={[styles.pillOptionText, newArtifact.type === t && { color: '#FFF' }]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Artifact title"
              placeholderTextColor="#2A2A40"
              value={newArtifact.title}
              onChangeText={(t) => setNewArtifact({ ...newArtifact, title: t })}
            />

            <Text style={styles.label}>Content</Text>
            <TextInput
              style={[styles.input, styles.contentInput]}
              placeholder="Describe the artifact..."
              placeholderTextColor="#2A2A40"
              value={newArtifact.content}
              onChangeText={(c) => setNewArtifact({ ...newArtifact, content: c })}
              multiline
            />

            <Text style={styles.label}>Owner Role</Text>
            <View style={styles.pillRow}>
              {Object.values(OwnerRole).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.pillOption,
                    newArtifact.owner_role === r && {
                      backgroundColor: ROLE_COLORS[r] || '#7C5CFC',
                      borderColor: ROLE_COLORS[r] || '#7C5CFC',
                    },
                  ]}
                  onPress={() => setNewArtifact({ ...newArtifact, owner_role: r as OwnerRole })}
                >
                  <Text style={[styles.pillOptionText, newArtifact.owner_role === r && { color: '#FFF' }]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNewModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
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
  listWrap: {
    flex: 1,
    width: '100%',
  },
  listWrapDesktop: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  listContent: {
    paddingBottom: 100,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 14,
    backgroundColor: '#0A0A0F',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C2E',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00F5A0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141E',
    borderWidth: 1,
    borderColor: '#1C1C2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
    maxWidth: 160,
  },
  teamBadgeIcon: {
    fontSize: 12,
    color: '#7C5CFC',
  },
  teamBadgeText: {
    fontSize: 12,
    color: '#9E9EB8',
    fontWeight: '600',
  },
  newButton: {
    backgroundColor: '#7C5CFC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0A0A0F',
    gap: 8,
  },
  searchIcon: {
    fontSize: 16,
    color: '#2A2A40',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1C1C2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#14141E',
    color: '#FFFFFF',
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#2A2A40',
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#0A0A0F',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1C1C2E',
    backgroundColor: '#14141E',
  },
  filterText: {
    fontSize: 12,
    color: '#5C5C78',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  countText: {
    fontSize: 11,
    color: '#2A2A40',
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#1C1C2E',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A3A50',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#2A2A40',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    justifyContent: 'center',
    flexGrow: 1,
  },
  modal: {
    backgroundColor: '#14141E',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1C1C2E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalClose: {
    fontSize: 18,
    color: '#2A2A40',
    fontWeight: '700',
    padding: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C5C78',
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pillOption: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1C1C2E',
    backgroundColor: '#0D0D1A',
  },
  pillOptionText: {
    fontSize: 12,
    color: '#5C5C78',
    fontWeight: '600',
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
  contentInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
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
