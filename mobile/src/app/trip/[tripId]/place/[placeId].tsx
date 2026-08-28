import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CommentBox } from '@/components/comment-box';
import { PlaceDetailSheet } from '@/components/place-detail-sheet';
import { PlaceNoteBox } from '@/components/place-note-box';
import { Screen } from '@/components/screen';
import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { VoteButtons } from '@/components/vote-buttons';
import { Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
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
  useComments,
  useExperiences,
  useRatings,
  useVotes,
} from '@/lib/hooks';
import { blockMember, reportComment, useBlockedMemberIds } from '@/lib/moderation';
import { getPlaceNote, upsertPlaceNote, usePlaceNotes } from '@/lib/notes';

export default function PlaceScreen() {
  const { placeId } = useLocalSearchParams<{ tripId: string; placeId: string }>();
  const { activeTripId, activeMember } = useTrip();

  const { experiences, loading } = useExperiences(activeTripId);
  const { votes } = useVotes(activeTripId);
  const { ratings } = useRatings(activeTripId);
  const { comments } = useComments(activeTripId);
  const { notes: placeNotes } = usePlaceNotes(activeTripId);
  const { blockedIds } = useBlockedMemberIds(activeTripId, activeMember?.id ?? null);

  const experience = experiences.find((e) => e.id === placeId);

  if (!experience) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: '' }} />
        <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
          {loading ? 'Loading…' : "That place isn't part of this trip."}
        </ThemedText>
      </Screen>
    );
  }

  const memberId = activeMember?.id;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: experience.name }} />
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="title">{experience.name}</ThemedText>

        <PlaceDetailSheet experience={experience} />

        {activeTripId && memberId && (
          <View style={styles.interactive}>
            <VoteButtons
              value={getMemberVote(votes, memberId, experience.id)}
              counts={getVoteCounts(votes, experience.id)}
              onChange={(vote) => upsertVote(activeTripId, memberId, experience.id, vote)}
            />

            <StarRating
              value={getMemberRating(ratings, memberId, experience.id)}
              average={getAverageRating(ratings, experience.id)}
              count={getRatingsForExperience(ratings, experience.id).length}
              onChange={(rating) => upsertRating(activeTripId, memberId, experience.id, rating)}
            />

            <CommentBox
              comments={getCommentsForExperience(comments, experience.id).filter((c) => !blockedIds.has(c.member_id))}
              myMemberId={memberId}
              onAdd={async (text) => {
                await addComment(activeTripId, memberId, experience.id, text);
              }}
              onReport={(commentId) => reportComment(activeTripId, commentId, memberId)}
              onBlock={(blockedMemberId) => blockMember(activeTripId, memberId, blockedMemberId)}
            />

            <PlaceNoteBox
              note={getPlaceNote(placeNotes, experience.id)}
              onSave={async (text) => {
                await upsertPlaceNote(activeTripId, memberId, experience.id, text);
              }}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.lg },
  interactive: { gap: Spacing.md },
  empty: { textAlign: 'center', marginTop: Spacing.xl, padding: Spacing.lg },
});
