"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// Fetch all votes for all experiences
export function useVotes() {
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVotes = useCallback(async () => {
    const { data, error } = await supabase
      .from("votes")
      .select("*, users(name, emoji)");
    if (!error && data) setVotes(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVotes();

    const channel = supabase
      .channel("votes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => fetchVotes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchVotes]);

  return { votes, loading, refetch: fetchVotes };
}

// Fetch all ratings
export function useRatings() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRatings = useCallback(async () => {
    const { data, error } = await supabase
      .from("ratings")
      .select("*, users(name, emoji)");
    if (!error && data) setRatings(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRatings();

    const channel = supabase
      .channel("ratings-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ratings" },
        () => fetchRatings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRatings]);

  return { ratings, loading, refetch: fetchRatings };
}

// Fetch all comments
export function useComments() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    const { data, error } = await supabase
      .from("comments")
      .select("*, users(name, emoji)")
      .order("created_at", { ascending: true });
    if (!error && data) setComments(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel("comments-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => fetchComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchComments]);

  return { comments, loading, refetch: fetchComments };
}

// Upsert a vote
export async function upsertVote(userId, experienceId, vote) {
  const { error } = await supabase.from("votes").upsert(
    {
      user_id: userId,
      experience_id: experienceId,
      vote,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,experience_id" }
  );
  return { error };
}

// Upsert a rating
export async function upsertRating(userId, experienceId, rating) {
  const { error } = await supabase.from("ratings").upsert(
    {
      user_id: userId,
      experience_id: experienceId,
      rating,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,experience_id" }
  );
  return { error };
}

// Add a comment
export async function addComment(userId, experienceId, text) {
  const { error } = await supabase.from("comments").insert({
    user_id: userId,
    experience_id: experienceId,
    text,
  });
  return { error };
}

// Delete a comment
export async function deleteComment(commentId) {
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);
  return { error };
}

// Aggregate helpers
export function getVotesForExperience(votes, experienceId) {
  return votes.filter((v) => v.experience_id === experienceId);
}

export function getRatingsForExperience(ratings, experienceId) {
  return ratings.filter((r) => r.experience_id === experienceId);
}

export function getCommentsForExperience(comments, experienceId) {
  return comments.filter((c) => c.experience_id === experienceId);
}

export function getAverageRating(ratings, experienceId) {
  const expRatings = getRatingsForExperience(ratings, experienceId);
  if (expRatings.length === 0) return 0;
  return (
    expRatings.reduce((sum, r) => sum + r.rating, 0) / expRatings.length
  );
}

export function getVoteCounts(votes, experienceId) {
  const expVotes = getVotesForExperience(votes, experienceId);
  return {
    go: expVotes.filter((v) => v.vote === "go").length,
    maybe: expVotes.filter((v) => v.vote === "maybe").length,
    skip: expVotes.filter((v) => v.vote === "skip").length,
    total: expVotes.length,
  };
}

export function getUserVote(votes, userId, experienceId) {
  return votes.find(
    (v) => v.user_id === userId && v.experience_id === experienceId
  )?.vote;
}

export function getUserRating(ratings, userId, experienceId) {
  return ratings.find(
    (r) => r.user_id === userId && r.experience_id === experienceId
  )?.rating;
}
