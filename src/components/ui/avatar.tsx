import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// A fixed, controlled palette -- deterministic per user id, never random per
// render (see DESIGN_SYSTEM.md §7 / the PRD's avatar requirements). All
// mid-to-light enough that near-black text reads on every one of them.
const AVATAR_COLORS = [
  '#C6F135',
  '#9B7BFF',
  '#FF6B4A',
  '#5AA9E6',
  '#3ED686',
  '#FFB020',
  '#FF5D7A',
  '#B6B0A2',
];
const AVATAR_TEXT_COLOR = '#14130F';

function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type AvatarProps = {
  /** Stable identifier (e.g. user id) the color is derived from. */
  id: string;
  name: string;
  size?: number;
};

export function Avatar({ id, name, size = 36 }: AvatarProps) {
  const backgroundColor = colorForKey(id);

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}
    >
      <ThemedText style={{ color: AVATAR_TEXT_COLOR, fontSize: size * 0.4, fontWeight: '700' }}>
        {initialsFor(name)}
      </ThemedText>
    </View>
  );
}

type AvatarStackProps = {
  members: { id: string; name: string }[];
  size?: number;
  max?: number;
};

export function AvatarStack({ members, size = 28, max = 4 }: AvatarStackProps) {
  const theme = useTheme();
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;

  return (
    <View style={styles.stack}>
      {shown.map((member, index) => (
        <View
          key={member.id}
          style={[
            styles.stackItem,
            { borderColor: theme.background, marginLeft: index === 0 ? 0 : -size * 0.3 },
          ]}
        >
          <Avatar id={member.id} name={member.name} size={size} />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={[
            styles.stackItem,
            styles.overflow,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size * 0.3,
              borderColor: theme.background,
              backgroundColor: theme.surfaceMuted,
            },
          ]}
        >
          <ThemedText type="caption" themeColor="textSecondary">
            +{overflow}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    flexDirection: 'row',
  },
  stackItem: {
    borderWidth: 2,
    borderRadius: 999,
  },
  overflow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
