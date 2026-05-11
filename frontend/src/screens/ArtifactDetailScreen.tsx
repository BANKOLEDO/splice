import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { ThreadView } from '../components/ThreadView';
import { api } from '../utils/api';
import { wsClient } from '../utils/websocket';
import {
  Artifact,
  Thread,
  Message,
  Role,
  TYPE_COLORS,
  STATUS_COLORS,
} from '../utils/types';
import { BREAKPOINTS } from '../utils/responsive';

interface ArtifactDetailScreenProps {
  route: { params: { artifact: Artifact } };
  navigation: any;
  currentUser: string;
  currentRole: Role;
}

export const ArtifactDetailScreen: React.FC<ArtifactDetailScreenProps> = ({
  route,
  navigation,
  currentUser,
  currentRole,
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.tablet;
  const { artifact: initialArtifact } = route.params;
  const [artifact, setArtifact] = useState<Artifact>(initialArtifact);
  const [thread, setThread] = useState<Thread>({ id: null, artifact_id: artifact.id, resolved: false, messages: [] });
  const [activeTab, setActiveTab] = useState<'thread' | 'details' | 'spec'>('thread');
  const [generatedSpec, setGeneratedSpec] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const fetchThread = useCallback(async () => {
    try {
      const data = await api.getThread(artifact.id);
      setThread(data);
    } catch (e) {
      console.warn('Failed to fetch thread:', e);
    }
  }, [artifact.id]);

  useEffect(() => {
    fetchThread();
    wsClient.joinArtifact(artifact.id);

    const unsub = wsClient.on('new_message', (data: any) => {
      if (data.artifact_id === artifact.id) {
        fetchThread();
      }
    });

    return () => {
      wsClient.leaveArtifact(artifact.id);
      unsub();
    };
  }, [artifact.id, fetchThread]);

  useEffect(() => {
    fetchArtifact();
  }, []);

  const fetchArtifact = async () => {
    try {
      const data = await api.getArtifact(artifact.id);
      setArtifact(data);
    } catch (e) {}
  };

  const handleSendMessage = async (content: string) => {
    try {
      await api.addMessage(artifact.id, {
        author: currentUser,
        role: currentRole,
        content,
        attachments: [],
        mentions: [],
      });
      fetchThread();
      fetchArtifact();
    } catch (e) {
      console.warn('Failed to send message:', e);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await api.updateArtifact(artifact.id, { status });
      fetchArtifact();
    } catch (e) {
      console.warn('Failed to update status:', e);
    }
  };

  const handleGenerateSpec = async () => {
    setGenerating(true);
    try {
      const result = await api.generateSpec(artifact.id);
      setGeneratedSpec(result.spec);
      setActiveTab('spec');
    } catch (e) {
      Alert.alert('Error', 'Failed to generate spec. Make sure the artifact has a thread with messages.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    const text = `Splice Artifact: ${artifact.title}\n\n${artifact.content.substring(0, 200)}...\n\nStatus: ${artifact.status}\nOwner: @${artifact.owner_role}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text });
      } else {
        await Share.share({ message: text });
      }
    } catch (e) {}
  };

  const statusOptions = ['draft', 'needs_review', 'approved', 'blocked', 'done'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{artifact.title}</Text>
          <View style={[styles.headerTypeIndicator, { backgroundColor: TYPE_COLORS[artifact.type] || '#7C5CFC' }]} />
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Text style={styles.shareText}>⇗</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.bodyWrap, isDesktop && styles.bodyWrapDesktop, { opacity: fadeAnim }]}>
      <View style={styles.meta}>
        <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[artifact.type] || '#7C5CFC' }]}>
          <Text style={styles.typeBadgeText}>{artifact.type.toUpperCase()}</Text>
        </View>
        <Text style={styles.metaOwner}>@{artifact.owner_role}</Text>
        <Text style={styles.metaDivider}>|</Text>
        <Text style={styles.metaAuthor}>{artifact.created_by}</Text>
        <View style={styles.metaSpacer} />
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[artifact.status] || '#5C5C78' }]}>
          <View style={styles.statusBadgeDot} />
          <Text style={styles.statusBadgeText}>{artifact.status.replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {['thread', 'details', 'spec'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'thread' ? '💬' : tab === 'details' ? '📄' : '📋'} {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'thread' && (
        <ThreadView
          artifactId={artifact.id}
          messages={thread?.messages || []}
          currentUser={currentUser}
          currentRole={currentRole}
          onSendMessage={handleSendMessage}
        />
      )}

      {activeTab === 'details' && (
        <ScrollView style={styles.detailsPanel}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusRow}>
            {statusOptions.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusPill,
                  artifact.status === s && {
                    backgroundColor: STATUS_COLORS[s] || '#5C5C78',
                    borderColor: STATUS_COLORS[s] || '#5C5C78',
                  },
                ]}
                onPress={() => handleStatusChange(s)}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    artifact.status === s && { color: '#FFF' },
                  ]}
                >
                  {s.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Content</Text>
            <Text style={styles.contentText}>{artifact.content}</Text>
          </View>

          {artifact.dependencies && artifact.dependencies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dependencies</Text>
              <View style={styles.depRow}>
                {artifact.dependencies.map((dep) => (
                  <TouchableOpacity
                    key={dep}
                    style={styles.depPill}
                    onPress={() => navigation.push('ArtifactDetail', { artifact: { id: dep } })}
                  >
                    <Text style={styles.depText}>{dep}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {artifact.metadata && Object.keys(artifact.metadata).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Metadata</Text>
              {Object.entries(artifact.metadata).map(([key, val]) => (
                <View key={key} style={styles.metaRow}>
                  <Text style={styles.metaKey}>{key}</Text>
                  <Text style={styles.metaValue}>{String(val)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity</Text>
            <Text style={styles.activityText}>Created {new Date(artifact.created_at * 1000).toLocaleString()}</Text>
            <Text style={styles.activityText}>Updated {new Date(artifact.updated_at * 1000).toLocaleString()}</Text>
          </View>

          {thread && thread.messages && thread.messages.length > 0 && (
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerateSpec}
              disabled={generating}
            >
              <Text style={styles.generateBtnText}>
                {generating ? 'Generating...' : 'Generate Spec from Thread'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {activeTab === 'spec' && (
        <ScrollView style={styles.specPanel}>
          {generatedSpec ? (
            <View style={styles.specCard}>
              <Text style={styles.specText}>{generatedSpec}</Text>
            </View>
          ) : (
            <View style={styles.specEmpty}>
              <Text style={styles.specEmptyIcon}>📋</Text>
              <Text style={styles.specEmptyText}>
                Generate a spec from the thread discussion
              </Text>
              <TouchableOpacity
                style={styles.generateBtn}
                onPress={handleGenerateSpec}
                disabled={generating}
              >
                <Text style={styles.generateBtnText}>
                  {generating ? 'Generating...' : 'Generate Spec'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  bodyWrap: {
    flex: 1,
    width: '100%',
  },
  bodyWrapDesktop: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#0A0A0F',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C2E',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
  },
  backIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  backText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTypeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  shareBtn: {
    paddingLeft: 12,
  },
  shareText: {
    fontSize: 22,
    color: '#5C5C78',
    fontWeight: '700',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0A0A0F',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C2E',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  metaOwner: {
    fontSize: 12,
    color: '#9E9EB8',
    fontWeight: '600',
  },
  metaDivider: {
    fontSize: 12,
    color: '#1C1C2E',
  },
  metaAuthor: {
    fontSize: 12,
    color: '#5C5C78',
  },
  metaSpacer: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  statusBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0F',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C2E',
    paddingHorizontal: 12,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 4,
  },
  tabActive: {
    borderBottomColor: '#7C5CFC',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A50',
  },
  tabTextActive: {
    color: '#7C5CFC',
  },
  detailsPanel: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C5C78',
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1C1C2E',
    backgroundColor: '#14141E',
  },
  statusPillText: {
    fontSize: 12,
    color: '#5C5C78',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#14141E',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1C1C2E',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C5C78',
    marginBottom: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  contentText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  depRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  depPill: {
    backgroundColor: '#0D0D1A',
    borderWidth: 1,
    borderColor: '#1C1C2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  depText: {
    fontSize: 12,
    color: '#7C5CFC',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C2E',
  },
  metaKey: {
    fontSize: 12,
    color: '#5C5C78',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 12,
    color: '#FFFFFF',
    maxWidth: '60%',
    textAlign: 'right',
  },
  activityText: {
    fontSize: 13,
    color: '#5C5C78',
    marginBottom: 4,
  },
  generateBtn: {
    backgroundColor: '#7C5CFC',
    padding: 12,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 4,
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  specPanel: {
    flex: 1,
    padding: 16,
  },
  specCard: {
    backgroundColor: '#14141E',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1C1C2E',
  },
  specText: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  specEmpty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  specEmptyIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  specEmptyText: {
    fontSize: 14,
    color: '#3A3A50',
    marginBottom: 20,
  },
});
