import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export const SkeletonCard: React.FC = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />
      <View style={styles.body}>
        <View style={styles.row}>
          <Animated.View style={[styles.chip, { opacity }]} />
          <Animated.View style={[styles.chipSmall, { opacity }]} />
        </View>
        <Animated.View style={[styles.titleLine, { opacity }]} />
        <Animated.View style={[styles.line, { opacity }]} />
        <Animated.View style={[styles.lineShort, { opacity }]} />
        <View style={styles.divider} />
        <Animated.View style={[styles.footerLine, { opacity }]} />
      </View>
    </View>
  );
};

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </>
);

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
    backgroundColor: '#1C1C2E',
  },
  body: {
    flex: 1,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chip: {
    width: 50,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1C1C2E',
  },
  chipSmall: {
    width: 70,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1C1C2E',
  },
  titleLine: {
    width: '75%',
    height: 16,
    borderRadius: 4,
    backgroundColor: '#1C1C2E',
    marginBottom: 8,
  },
  line: {
    width: '100%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#1C1C2E',
    marginBottom: 4,
  },
  lineShort: {
    width: '60%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#1C1C2E',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#1C1C2E',
    marginBottom: 8,
  },
  footerLine: {
    width: '40%',
    height: 11,
    borderRadius: 4,
    backgroundColor: '#1C1C2E',
  },
});
