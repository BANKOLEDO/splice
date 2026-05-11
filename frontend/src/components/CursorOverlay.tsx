import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ActiveUser, ROLE_COLORS } from '../utils/types';

interface CursorOverlayProps {
  users: ActiveUser[];
  cursors: Record<string, { x: number; y: number }>;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ users, cursors }) => (
  <>
    {Object.entries(cursors).map(([userId, pos]) => (
      <View
        key={userId}
        style={[
          styles.cursor,
          { left: pos.x, top: pos.y },
        ]}
      >
        <Text style={styles.cursorArrow}>▸</Text>
        <Text style={[styles.cursorLabel, { backgroundColor: ROLE_COLORS[users.find(u => u.user_id === userId)?.role || 'dev'] || '#D94A2A' }]}>
          {userId}
        </Text>
      </View>
    ))}
  </>
);

const styles = StyleSheet.create({
  cursor: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
    pointerEvents: 'none',
  },
  cursorArrow: {
    fontSize: 16,
    color: '#00F5A0',
    opacity: 0.8,
  },
  cursorLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: -2,
  },
});
