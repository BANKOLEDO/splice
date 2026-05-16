import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Artifact, TYPE_COLORS, STATUS_COLORS } from '../utils/types';
import { sanitizeDisplay } from '@/utils/sanitize';

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

export const ArtifactCard: React.FC<ArtifactCardProps> = ({ artifact, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={() => onPress(artifact)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.card}
        activeOpacity={1}
      >
        <View style={[styles.accentBar, { backgroundColor: TYPE_COLORS[artifact.type] || '#7C5CFC' }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[artifact.type] || '#7C5CFC' }]}>
              <Text style={styles.typeText}>{artifact.type.toUpperCase()}</Text>
            </View>
            <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[artifact.status] || '#2A2A40' }]}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[artifact.status] || '#5C5C78' }]} />
              <Text style={[styles.statusText, { color: STATUS_COLORS[artifact.status] || '#5C5C78' }]}>
                {artifact.status.replace('_', ' ')}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{sanitizeDisplay(artifact.title)}</Text>
          <Text style={styles.preview} numberOfLines={2}>
            {truncate(sanitizeDisplay(artifact.content), 120)}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={styles.owner}>@{artifact.owner_role}</Text>
            <Text style={styles.sep}>·</Text>
            <Text style={styles.author}>{artifact.created_by}</Text>
            <Text style={styles.time}>{formatTime(artifact.updated_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#14141E',
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1C1C2E',
  },
  accentBar: {
    width: 3,
  },
  cardBody: {
    flex: 1,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
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
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  preview: {
    fontSize: 12,
    color: '#5C5C78',
    marginBottom: 8,
    lineHeight: 17,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#1C1C2E',
    paddingTop: 8,
  },
  owner: {
    fontSize: 11,
    color: '#3A3A50',
    fontWeight: '600',
  },
  sep: {
    fontSize: 11,
    color: '#1C1C2E',
  },
  author: {
    fontSize: 11,
    color: '#3A3A50',
  },
  time: {
    fontSize: 11,
    color: '#2A2A40',
    marginLeft: 'auto',
  },
});
