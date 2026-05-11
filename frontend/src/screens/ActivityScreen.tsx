import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { api } from '../utils/api';
import { BREAKPOINTS } from '../utils/responsive';

interface ActivityEvent {
  id: string;
  type: string;
  artifact_id: string;
  artifact_title: string;
  user: string;
  timestamp: number;
  detail: string;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() / 1000 - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = new Date(timestamp * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getIcon(type: string): string {
  switch (type) {
    case 'created': return '+';
    case 'updated': return '✎';
    case 'message': return '💬';
    case 'status_change': return '◆';
    default: return '·';
  }
}

export const ActivityScreen: React.FC<{ currentUser: string; onNavigateToDetail?: (artifact: any) => void }> = ({ currentUser, onNavigateToDetail }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.tablet;
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = useCallback(async () => {
    try {
      const data = await api.getArtifacts({ limit: 20 });
      const activities: ActivityEvent[] = data.flatMap((a: any) => [
        {
          id: `c-${a.id}`,
          type: 'created',
          artifact_id: a.id,
          artifact_title: a.title,
          user: a.created_by,
          timestamp: a.created_at,
          detail: 'created artifact',
        },
        {
          id: `u-${a.id}`,
          type: 'updated',
          artifact_id: a.id,
          artifact_title: a.title,
          user: a.created_by,
          timestamp: a.updated_at,
          detail: `status: ${a.status}`,
        },
      ]);
      activities.sort((a, b) => b.timestamp - a.timestamp);
      setEvents(activities.slice(0, 50));
    } catch (e) {
      console.warn('Failed to fetch activity:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const renderItem = ({ item }: { item: ActivityEvent }) => (
    <TouchableOpacity
      style={styles.event}
      onPress={() => onNavigateToDetail?.({ id: item.artifact_id, title: item.artifact_title })}
      activeOpacity={0.7}
    >
      <View style={styles.eventDot}>
        <Text style={styles.eventIcon}>{getIcon(item.type)}</Text>
      </View>
      <View style={styles.eventBody}>
        <View style={styles.eventRow}>
          <Text style={styles.eventUser}>{item.user}</Text>
          <Text style={styles.eventDetail}>{item.detail}</Text>
        </View>
        <Text style={styles.eventArtifact}>{item.artifact_title}</Text>
        <Text style={styles.eventTime}>{formatTime(item.timestamp)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>⟳</Text>
      <Text style={styles.emptyText}>No activity yet</Text>
      <Text style={styles.emptySubtext}>Changes to artifacts will appear here</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.wrap, isDesktop && styles.wrapDesktop]}>
        <View style={styles.headerArea}>
          <Text style={styles.headerTitle}>Activity</Text>
        </View>
        <FlatList
          data={loading ? [] : events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={loading ? null : renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchActivity(); }} tintColor="#7C5CFC" />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
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
  listContent: {
    paddingVertical: 8,
    paddingBottom: 40,
  },
  event: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0D0D1A',
  },
  eventDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#14141E',
    borderWidth: 1,
    borderColor: '#1C1C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  eventIcon: {
    fontSize: 11,
    color: '#5C5C78',
  },
  eventBody: {
    flex: 1,
  },
  eventRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
  },
  eventUser: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  eventDetail: {
    fontSize: 13,
    color: '#5C5C78',
  },
  eventArtifact: {
    fontSize: 12,
    color: '#7C5CFC',
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 11,
    color: '#2A2A40',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 40,
    color: '#1C1C2E',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A3A50',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#2A2A40',
  },
});
