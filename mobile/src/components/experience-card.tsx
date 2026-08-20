import { StyleSheet, View } from 'react-native';

import { CommentBox } from '@/components/comment-box';
import { PlaceNoteBox } from '@/components/place-note-box';
import { StarRating } from '@/components/star-rating';
import { TagPill } from '@/components/tag-pill';
import { ThemedText } from '@/components/themed-text';
import { VoteButtons } from '@/components/vote-buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addComment,
  getAverageRating,
  getCommentsForExperience,
  getMemberRating,
  getMemberVote,
  getRatingsForExperience,
  getVoteCounts,
  upsertRating,
  upsertVote,
  type Comment,
  type Experience,
  type Rating,
  type Vote,
} from '@/lib/hooks';
import { getPlaceNote, upsertPlaceNote, type PlaceNote } from '@/lib/notes';

export function ExperienceCard({
  experience,
  tripId,
  memberId,
  votes,
  ratings,
  comments,
  placeNotes,
}: {
  experience: Experience;
  tripId: string;
  memberId: string;
  votes: Vote[];
  ratings: Rating[];
  comments: Comment[];
  placeNotes: PlaceNote[];
}) {
  const theme = useTheme();
  const counts = getVoteCounts(votes, experience.id);
  const myVote = getMemberVote(votes, memberId, experience.id);
  const myRating = getMemberRating(ratings, memberId, experience.id);
  const avgRating = getAverageRating(ratings, experience.id);
  const experienceRatings = getRatingsForExperience(ratings, experience.id);
  const experienceComments = getCommentsForExperience(comments, experience.id);

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <ThemedText type="default" style={{ flex: 1 }}>
          {experience.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          {experience.time}
        </ThemedText>
      </View>

      {!!experience.description && (
        <ThemedText type="small" themeColor="textSecondary">
          {experience.description}
        </ThemedText>
      )}

      {experience.tags.length > 0 && (
        <View style={styles.tagRow}>
          {experience.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </View>
      )}

      <ThemedText type="small" themeColor="textMuted">
        ₾{experience.priceLari}
      </ThemedText>

      <VoteButtons
        value={myVote}
        counts={counts}
        onChange={(vote) => upsertVote(tripId, memberId, experience.id, vote)}
      />

      <StarRating
        value={myRating}
        average={avgRating}
        count={experienceRatings.length}
        onChange={(rating) => upsertRating(tripId, memberId, experience.id, rating)}
      />

      <CommentBox
        comments={experienceComments}
        onAdd={async (text) => {
          await addComment(tripId, memberId, experience.id, text);
        }}
      />

      <PlaceNoteBox
        note={getPlaceNote(placeNotes, experience.id)}
        onSave={async (text) => {
          await upsertPlaceNote(tripId, memberId, experience.id, text);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
