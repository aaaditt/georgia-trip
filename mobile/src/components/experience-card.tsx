import { Pressable, StyleSheet, View } from 'react-native';

import { TagPill } from '@/components/tag-pill';
import { ThemedText } from '@/components/themed-text';
import { VoteButtons } from '@/components/vote-buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getCommentsForExperience,
  getMemberVote,
  getVoteCounts,
  upsertVote,
  type Comment,
  type Experience,
  type Vote,
} from '@/lib/hooks';

export function ExperienceCard({
  experience,
  tripId,
  memberId,
  votes,
  comments,
  onPress,
}: {
  experience: Experience;
  tripId: string;
  memberId: string;
  votes: Vote[];
  comments: Comment[];
  onPress: () => void;
}) {
  const theme = useTheme();
  const commentCount = getCommentsForExperience(comments, experience.id).length;
  const price = experience.priceLari && experience.priceLari !== '—' ? experience.priceLari : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <ThemedText type="default" style={{ flex: 1 }}>
          {experience.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          {experience.time}
        </ThemedText>
      </View>

      {!!(experience.hook || experience.description) && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {experience.hook || experience.description}
        </ThemedText>
      )}

      {experience.tags.length > 0 && (
        <View style={styles.tagRow}>
          {experience.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </View>
      )}

      <View style={styles.metaRow}>
        {/* price_lari already reads "Free" or "₾20 + boat", so it is not
            prefixed with a currency symbol here — the old card rendered
            "₾Free".

            Clamped to one line and allowed to shrink: the catalog's price
            strings are meant to be compact, but a long one must not be able
            to wrap this row and shove the comment count and Details out of
            alignment. The full nuance lives in the place page's Cost fact
            and its tips, both of which wrap freely. */}
        <ThemedText type="small" themeColor="textMuted" numberOfLines={1} style={styles.price}>
          {price ?? 'Free'}
        </ThemedText>
        {commentCount > 0 && (
          <ThemedText type="small" themeColor="textMuted" style={styles.noShrink}>
            💬 {commentCount}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="accent" style={styles.more}>
          Details &rsaquo;
        </ThemedText>
      </View>

      <VoteButtons
        value={getMemberVote(votes, memberId, experience.id)}
        counts={getVoteCounts(votes, experience.id)}
        onChange={(vote) => upsertVote(tripId, memberId, experience.id, vote)}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  price: { flexShrink: 1 },
  noShrink: { flexShrink: 0 },
  more: { marginLeft: 'auto', flexShrink: 0 },
});
