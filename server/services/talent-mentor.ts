/**
 * §10.4 — Mentor matching service.
 *
 * Recommends tutors for students based on their North Star skill
 * and the tutor's declared subjects (via tutor_subjects).
 */

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  subjects,
  subjectSkills,
  users,
  tutorProfiles,
  tutorSubjects,
  mentorRecommendations,
  talentProfiles,
} from "@/server/db/schema";
import type { User } from "@/server/db/schema/users";
import type { MentorRecommendation } from "@/server/db/schema/talent";
import type { SubjectSkill } from "@/server/db/schema/schools";

/* ── Types ─────────────────────────────────────────────────── */

export type TutorCandidate = Pick<
  User,
  "id" | "firstName" | "lastName" | "email" | "avatarUrl"
> & {
  bio: string | null;
  matchScore: number;
  reason: string;
  sharedSubjects: string[];
};

export type MentorRecommendationWithTutor = MentorRecommendation & {
  tutor: Pick<
    User,
    "id" | "firstName" | "lastName" | "email" | "avatarUrl"
  >;
  skill: Pick<SubjectSkill, "id" | "name"> | null;
};

/* ── Tutor discovery ──────────────────────────────────────── */

/**
 * Find tutors whose expertise matches the student's North Star skill.
 * Matches on shared subjects (the tutor teaches a subject that
 * contains the North Star skill).
 */
export async function findMatchingTutors(
  studentId: string,
  limit = 5,
): Promise<TutorCandidate[]> {
  const db = await getDb();

  // Get the student's profile + North Star.
  const profile = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.studentId, studentId))
    .limit(1);
  if (!profile.at(0) || !profile[0]!.northStarSkillId) {
    return [];
  }

  // Find the skill's subject.
  const skillRows = await db
    .select({
      skillId: subjectSkills.id,
      skillName: subjectSkills.name,
      subjectId: subjectSkills.subjectId,
      subjectName: subjects.name,
    })
    .from(subjectSkills)
    .leftJoin(subjects, eq(subjects.id, subjectSkills.subjectId))
    .where(eq(subjectSkills.id, profile[0]!.northStarSkillId))
    .limit(1);
  const skill = skillRows.at(0);
  if (!skill || !skill.subjectId) return [];

  // Find tutor_profiles that teach this subject.
  const tutorSubjectRows = await db
    .select({
      tutorProfileId: tutorSubjects.tutorProfileId,
    })
    .from(tutorSubjects)
    .where(eq(tutorSubjects.subjectId, skill.subjectId));

  if (tutorSubjectRows.length === 0) return [];

  const tutorProfileIds = tutorSubjectRows.map((r) => r.tutorProfileId);

  // Fetch the tutor profiles + their user info.
  const profilesWithUsers = await db
    .select({
      profile: tutorProfiles,
      user: users,
    })
    .from(tutorProfiles)
    .leftJoin(users, eq(users.id, tutorProfiles.userId))
    .where(inArray(tutorProfiles.id, tutorProfileIds));

  const candidates: TutorCandidate[] = profilesWithUsers
    .filter((r) => r.user !== null)
    .map((r) => {
      const user = r.user!;
      const tutorProfile = r.profile;
      const matchScore = Math.min(
        1,
        0.6 + (tutorProfile.isVerified ? 0.2 : 0) + (tutorProfile.ratingCount > 0 ? 0.2 : 0),
      );
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: tutorProfile.bio,
        matchScore,
        sharedSubjects: [skill.subjectName ?? skill.skillName ?? "Subject"],
        reason: `Enseigne ${skill.subjectName ?? "cette matière"}${
          tutorProfile.isVerified ? " · Vérifié" : ""
        }${
          tutorProfile.ratingCount > 0
            ? ` · ${tutorProfile.ratingAvg}★ (${tutorProfile.ratingCount})`
            : ""
        }`,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  return candidates;
}

/* ── Recommendation lifecycle ────────────────────────────── */

/**
 * Create mentor recommendations for a student based on the top
 * matching tutors.
 */
export async function generateMentorRecommendations(
  studentId: string,
): Promise<MentorRecommendation[]> {
  const db = await getDb();
  const candidates = await findMatchingTutors(studentId, 5);

  const profile = await db
    .select()
    .from(talentProfiles)
    .where(eq(talentProfiles.studentId, studentId))
    .limit(1);
  const northStarSkillId = profile.at(0)?.northStarSkillId ?? null;

  const created: MentorRecommendation[] = [];
  for (const candidate of candidates) {
    // Check if a recommendation already exists.
    const existing = await db
      .select()
      .from(mentorRecommendations)
      .where(
        and(
          eq(mentorRecommendations.studentId, studentId),
          eq(mentorRecommendations.tutorId, candidate.id),
        ),
      )
      .limit(1);
    if (existing.at(0)) {
      created.push(existing[0]!);
      continue;
    }
    const [reco] = await db
      .insert(mentorRecommendations)
      .values({
        studentId,
        tutorId: candidate.id,
        matchScore: candidate.matchScore,
        status: "suggested",
        reason: candidate.reason,
        skillId: northStarSkillId,
      })
      .returning();
    if (reco) created.push(reco);
  }
  return created;
}

/**
 * List all mentor recommendations for a student, with the tutor info.
 */
export async function listMentorRecommendations(
  studentId: string,
): Promise<MentorRecommendationWithTutor[]> {
  const db = await getDb();
  const rows = await db
    .select({
      reco: mentorRecommendations,
      tutor: users,
      skill: subjectSkills,
    })
    .from(mentorRecommendations)
    .leftJoin(users, eq(users.id, mentorRecommendations.tutorId))
    .leftJoin(
      subjectSkills,
      eq(subjectSkills.id, mentorRecommendations.skillId),
    )
    .where(eq(mentorRecommendations.studentId, studentId))
    .orderBy(desc(mentorRecommendations.matchScore));

  return rows.map((r) => ({
    ...r.reco,
    tutor: r.tutor
      ? {
          id: r.tutor.id,
          firstName: r.tutor.firstName,
          lastName: r.tutor.lastName,
          email: r.tutor.email,
          avatarUrl: r.tutor.avatarUrl,
        }
      : {
          id: "",
          firstName: "Unknown",
          lastName: "",
          email: "",
          avatarUrl: null,
        },
    skill: r.skill ? { id: r.skill.id, name: r.skill.name } : null,
  }));
}

/**
 * Respond to a mentor recommendation (accept / reject).
 */
export async function respondToRecommendation(
  recommendationId: string,
  studentId: string,
  status: "accepted" | "rejected",
): Promise<void> {
  const db = await getDb();
  await db
    .update(mentorRecommendations)
    .set({ status, decidedAt: new Date() })
    .where(
      and(
        eq(mentorRecommendations.id, recommendationId),
        eq(mentorRecommendations.studentId, studentId),
      ),
    );
}
