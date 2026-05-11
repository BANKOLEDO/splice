import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { ArtifactCard } from '../components/ArtifactCard';
import { api } from '../utils/api';
import { Artifact, ArtifactType, ArtifactStatus, OwnerRole, TYPE_COLORS } from '../utils/types';
import { BREAKPOINTS } from '../utils/responsive';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Spec', value: 'spec' },
  { label: 'Design', value: 'design' },
  { label: 'API', value: 'api' },
  { label: 'UI', value: 'ui' },
  { label: 'Task', value: 'task' },
  { label: 'Question', value: 'question' },
];

export const HomeScreen: React.FC<{ navigation: any; currentUser: string }> = ({
  navigation,
  currentUser,
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.tablet;
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
      const data = await api.getArtifacts({ limit: 100 });
      setArtifacts(data);
    } catch (e) {
      console.warn('Failed to fetch artifacts:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
        <TouchableOpacity style={styles.newButton} onPress={() => setShowNewModal(true)}>
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search artifacts..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[
              styles.filterChip,
              activeFilter === f.value && {
                backgroundColor: f.value ? TYPE_COLORS[f.value] || '#1A1A1A' : '#1A1A1A',
                borderColor: f.value ? TYPE_COLORS[f.value] || '#1A1A1A' : '#1A1A1A',
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
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Artifact</Text>

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {Object.values(ArtifactType).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeOption,
                    newArtifact.type === t && { backgroundColor: TYPE_COLORS[t] || '#1A1A1A' },
                  ]}
                  onPress={() => setNewArtifact({ ...newArtifact, type: t as ArtifactType })}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      newArtifact.type === t && { color: '#FFF' },
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Artifact title"
              placeholderTextColor="#999"
              value={newArtifact.title}
              onChangeText={(t) => setNewArtifact({ ...newArtifact, title: t })}
            />

            <Text style={styles.label}>Content</Text>
            <TextInput
              style={[styles.input, styles.contentInput]}
              placeholder="Describe the artifact..."
              placeholderTextColor="#999"
              value={newArtifact.content}
              onChangeText={(c) => setNewArtifact({ ...newArtifact, content: c })}
              multiline
            />

            <Text style={styles.label}>Owner Role</Text>
            <View style={styles.typeRow}>
              {Object.values(OwnerRole).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleOption,
                    newArtifact.owner_role === r && styles.roleOptionActive,
                  ]}
                  onPress={() => setNewArtifact({ ...newArtifact, owner_role: r as OwnerRole })}
                >
                  <Text
                    style={[
                      styles.roleText,
                      newArtifact.owner_role === r && styles.roleTextActive,
                    ]}
                  >
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
    paddingBottom: 16,
    backgroundColor: '#14141E',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A40',
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
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  newButton: {
    backgroundColor: '#7C5CFC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#14141E',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#2A2A40',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#1C1C2E',
    color: '#FFFFFF',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: '#14141E',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A40',
    backgroundColor: '#1C1C2E',
  },
  filterText: {
    fontSize: 12,
    color: '#9E9EB8',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  countText: {
    fontSize: 12,
    color: '#5C5C78',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#2A2A40',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5C5C78',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#3A3A50',
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
    borderColor: '#2A2A40',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    color: '#FFFFFF',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9E9EB8',
    marginBottom: 6,
    marginTop: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2A2A40',
    backgroundColor: '#1C1C2E',
  },
  typeOptionText: {
    fontSize: 12,
    color: '#9E9EB8',
    fontWeight: '600',
  },
  roleOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2A2A40',
    backgroundColor: '#1C1C2E',
  },
  roleOptionActive: {
    backgroundColor: '#7C5CFC',
    borderColor: '#7C5CFC',
  },
  roleText: {
    fontSize: 12,
    color: '#9E9EB8',
    fontWeight: '600',
  },
  roleTextActive: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#2A2A40',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#1C1C2E',
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
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  cancelText: {
    fontSize: 14,
    color: '#9E9EB8',
    fontWeight: '600',
  },
  createBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#7C5CFC',
  },
  createText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
