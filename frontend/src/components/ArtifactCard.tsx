import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Artifact, TYPE_COLORS, STATUS_COLORS } from '../utils/types';

interface ArtifactCardProps {
  artifact: Artifact;
  onPress: (artifact: Artifact) => void;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() / 1000 - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.substring(0, len) + '...';
}

export const ArtifactCard: React.FC<ArtifactCardProps> = ({ artifact, onPress }) => (
  <TouchableOpacity onPress={() => onPress(artifact)} style={styles.card}>
    <View style={[styles.accentBar, { backgroundColor: TYPE_COLORS[artifact.type] || '#7C5CFC' }]} />
    <View style={styles.cardBody}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[artifact.type] || '#7C5CFC' }]}>
          <Text style={styles.typeText}>{artifact.type.toUpperCase()}</Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[artifact.status] || '#5C5C78' }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[artifact.status] || '#5C5C78' }]} />
          <Text style={[styles.statusText, { color: STATUS_COLORS[artifact.status] || '#5C5C78' }]}>
            {artifact.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{artifact.title}</Text>
      <Text style={styles.preview} numberOfLines={2}>
        {truncate(artifact.content, 120)}
      </Text>

      <View style={styles.cardFooter}>
        <Text style={styles.owner}>@{artifact.owner_role}</Text>
        <Text style={styles.owner}>{artifact.created_by}</Text>
        <Text style={styles.time}>{formatTime(artifact.updated_at)}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#2A2A40',
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: '#14141E',
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  cardBody: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  preview: {
    fontSize: 13,
    color: '#9E9EB8',
    marginBottom: 12,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2A2A40',
    paddingTop: 10,
  },
  owner: {
    fontSize: 12,
    color: '#6B6B80',
  },
  time: {
    fontSize: 11,
    color: '#5C5C78',
  },
});
