import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export function ScreenShell({
  children,
  bottomSafeArea = false,
}: {
  children: ReactNode;
  bottomSafeArea?: boolean;
}) {
  const colors = useColors();
  return (
    <SafeAreaView
      edges={bottomSafeArea ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
      style={[
        styles.shell,
        { backgroundColor: colors.background },
        Platform.OS === 'web' && {
          paddingTop: 67,
          paddingBottom: bottomSafeArea ? 34 : 0,
          minHeight: '100%',
        },
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  const colors = useColors();
  return (
    <View style={[styles.brandMark, { width: size, height: size }]}>
      <View style={[styles.markBar, styles.markBarTop, { backgroundColor: colors.primary }]} />
      <View style={[styles.markBar, styles.markBarMiddle, { backgroundColor: colors.foreground }]} />
      <View style={[styles.markBar, styles.markBarBottom, { backgroundColor: colors.mutedForeground }]} />
    </View>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  const colors = useColors();
  return (
    <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
      {children}
    </Text>
  );
}

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function BackHeader({
  title,
  caption,
}: {
  title: string;
  caption: string;
}) {
  const colors = useColors();
  const router = useRouter();
  return (
    <View style={styles.backHeader}>
      <Pressable
        testID="back-button"
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        }}
        style={({ pressed }) => [
          styles.backButton,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && styles.pressed,
        ]}
      >
        <Feather name="arrow-left" size={19} color={colors.foreground} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.headerCaption, { color: colors.mutedForeground }]}>{caption}</Text>
      </View>
      <BrandMark size={28} />
    </View>
  );
}

export function InfoPanel({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.infoPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.infoIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={17} color={colors.primary} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={[styles.infoTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.infoBody, { color: colors.mutedForeground }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  brandMark: { position: 'relative', justifyContent: 'center' },
  markBar: { position: 'absolute', height: 4, borderRadius: 2 },
  markBarTop: { width: '70%', top: '23%' },
  markBarMiddle: { width: '94%', top: '47%' },
  markBarBottom: { width: '58%', top: '71%' },
  eyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.65 },
  sectionHeading: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.45 },
  sectionAction: { fontSize: 12, fontWeight: '600' },
  backHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  backButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 3 },
  headerTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  headerCaption: { fontSize: 10, fontWeight: '600', letterSpacing: 1.1, textTransform: 'uppercase' },
  infoPanel: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  infoIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  infoCopy: { flex: 1, gap: 5 },
  infoTitle: { fontSize: 13, fontWeight: '700' },
  infoBody: { fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.72 },
});
