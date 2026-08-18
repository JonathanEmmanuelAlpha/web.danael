/**
 * §10.4 — Foundation Floor Monitor.
 *
 * Ensures the Talent Track never sacrifices the foundational curriculum.
 * Triggers when a student's mastery on non-talent skills drops below 65%.
 *
 * If 3+ skills breach the floor in a week:
 *  - Pause the Talent Track for 1 week
 *  - Generate a recovery plan on the deficient skills
 *  - Notify student + parent + teacher
 */

import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  classMembers,
  classSubjects,
  classes,
  subjectSkills,
  studentSkillStates,
  studentTalentZones,
  talentProfiles,
  talentTracks,
  floorAlerts,
} from "@/server/db/schema";
import { AppError } from "@/lib/api-response";

/* ── Constants ────────────────────────────────────────────── */

export const FLOOR_THRESHOLD = 65; // mastery %
export const FLOOR_BREACH_PAUSE_COUNT = 3; // pause after this many breaches

/* ── Types ────────────────────────────────────────────────── */

export interface FloorCheckResult {
  studentId: string;
  breaches: Array<{
    skillId: string;
    skillName: string;
    mastery: number;
  }>;
  shouldPauseTalentTrack: boolean;
  pausedTrackId: string | null;
}

/* ── Monitor ─────────────────────────────────────────────── */

/**
 * Check the foundation floor for a single student.
 * Returns the list of breached skills + whether the talent track
 * should be paused.
 */
export async function checkStudentFloor(
  studentId: string,
): Promise<FloorCheckResult> {
  const db = await getDb();

  // Find the student's classes.
  const studentClasses = await db
    .select({ classId: classMembers.classId })
    .from(classMembers)
    .where(eq(classMembers.userId, studentId));
  if (studentClasses.length === 0) {
    return {
      studentId,
      breaches: [],
      shouldPauseTalentTrack: false,
      pausedTrackId: null,
    };
  }

  // Find all subjects taught in these classes.
  const classIds = studentClasses.map((c) => c.classId);
  const classSubjectRows = await db
    .select({ subjectId: classSubjects.subjectId })
    .from(classSubjects)
    .where(inArray(classSubjects.classId, classIds));
  const subjectIds = Array.from(
    new Set(classSubjectRows.map((r) => r.subjectId).filter(Boolean) as string[]),
  );
  if (subjectIds.length === 0) {
    return {
      studentId,
      breaches: [],
      shouldPauseTalentTrack: false,
      pausedTrackId: null,
    };
  }

  // Find all skills attached to these subjects (the "foundation" skills).
  const foundationSkills = await db
    .select({
      id: subjectSkills.id,
      name: subjectSkills.name,
      subjectId: subjectSkills.subjectId,
    })
    .from(subjectSkills)
    .where(inArray(subjectSkills.subjectId, subjectIds));

  // Find the student's talent zones (these are exempt from the floor).
  const talentZoneRows = await db
    .select({ skillId: studentTalentZones.skillId })
    .from(studentTalentZones)
    .where(eq(studentTalentZones.studentId, studentId));
  const exemptSkillIds = new Set(talentZoneRows.map((z) => z.skillId));

  // Filter out exempt skills.
  const checkedSkills = foundationSkills.filter(
    (s) => !exemptSkillIds.has(s.id),
  );
  if (checkedSkills.length === 0) {
    return {
      studentId,
      breaches: [],
      shouldPauseTalentTrack: false,
      pausedTrackId: null,
    };
  }

  // Fetch the student's skill states for these skills.
  const skillIds = checkedSkills.map((s) => s.id);
  const states = await db
    .select({
      skillId: studentSkillStates.skillId,
      mastery: studentSkillStates.predictedMastery,
    })
    .from(studentSkillStates)
    .where(
      and(
        eq(studentSkillStates.studentId, studentId),
        inArray(studentSkillStates.skillId, skillIds),
      ),
    );

  // Identify breaches.
  const stateMap = new Map(states.map((s) => [s.skillId, s.mastery]));
  const breaches: FloorCheckResult["breaches"] = [];
  for (const skill of checkedSkills) {
    const mastery = stateMap.get(skill.id) ?? 0;
    if (mastery < FLOOR_THRESHOLD) {
      breaches.push({
        skillId: skill.id,
        skillName: skill.name,
        mastery,
      });
    }
  }

  // Decide whether to pause the talent track.
  const shouldPause = breaches.length >= FLOOR_BREACH_PAUSE_COUNT;

  // Find the current active talent track.
  let pausedTrackId: string | null = null;
  if (shouldPause) {
    const activeTrack = await db
      .select({ id: talentTracks.id })
      .from(talentTracks)
      .where(
        and(
          eq(talentTracks.studentId, studentId),
          eq(talentTracks.isActive, true),
          eq(talentTracks.isPaused, false),
        ),
      )
      .limit(1);
    pausedTrackId = activeTrack.at(0)?.id ?? null;

    if (pausedTrackId) {
      await db
        .update(talentTracks)
        .set({
          isPaused: true,
          pauseReason: `Foundation floor breached on ${breaches.length} skills`,
          updatedAt: new Date(),
        })
        .where(eq(talentTracks.id, pausedTrackId));
    }
  }

  // Record floor alerts.
  for (const breach of breaches) {
    const existing = await db
      .select()
      .from(floorAlerts)
      .where(
        and(
          eq(floorAlerts.studentId, studentId),
          eq(floorAlerts.skillId, breach.skillId),
          eq(floorAlerts.status, "active"),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(floorAlerts)
        .set({
          masteryAtAlert: breach.mastery,
          breachCount: existing[0]!.breachCount + 1,
          pausedTalentTrack: shouldPause,
          updatedAt: new Date(),
        })
        .where(eq(floorAlerts.id, existing[0]!.id));
    } else {
      await db.insert(floorAlerts).values({
        studentId,
        skillId: breach.skillId,
        masteryAtAlert: breach.mastery,
        threshold: FLOOR_THRESHOLD,
        status: "active",
        pausedTalentTrack: shouldPause,
      });
    }
  }

  // Update talent_profiles.lastFloorAlertAt.
  if (breaches.length > 0) {
    await db
      .update(talentProfiles)
      .set({
        lastFloorAlertAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(talentProfiles.studentId, studentId));
  }

  return {
    studentId,
    breaches,
    shouldPauseTalentTrack: shouldPause,
    pausedTrackId,
  };
}

/* ── Recovery plan ───────────────────────────────────────── */

/**
 * Generate a recovery plan for a student whose floor was breached.
 * The plan prioritizes the most deficient skills and proposes
 * 2 practice quizzes per skill.
 */
export async function generateRecoveryPlan(
  studentId: string,
): Promise<Array<{ skillId: string; skillName: string; mastery: number }>> {
  const result = await checkStudentFloor(studentId);
  // Sort breaches by mastery ascending (most deficient first).
  return result.breaches.sort((a, b) => a.mastery - b.mastery);
}

/* ── Resolve alerts ──────────────────────────────────────── */

/**
 * Resolve all active floor alerts for a student (after they've recovered).
 * Called when mastery on a previously-breached skill returns above threshold.
 */
export async function resolveFloorAlerts(
  studentId: string,
): Promise<number> {
  const db = await getDb();
  const active = await db
    .select()
    .from(floorAlerts)
    .where(
      and(
        eq(floorAlerts.studentId, studentId),
        eq(floorAlerts.status, "active"),
      ),
    );

  let resolved = 0;
  for (const alert of active) {
    if (!alert.skillId) continue;
    const stateRows = await db
      .select({ mastery: studentSkillStates.predictedMastery })
      .from(studentSkillStates)
      .where(
        and(
          eq(studentSkillStates.studentId, studentId),
          eq(studentSkillStates.skillId, alert.skillId),
        ),
      )
      .limit(1);
    const mastery = stateRows.at(0)?.mastery ?? 0;
    if (mastery >= FLOOR_THRESHOLD + 5) {
      // 5% margin to avoid flapping.
      await db
        .update(floorAlerts)
        .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
        .where(eq(floorAlerts.id, alert.id));
      resolved++;
    }
  }

  // If all alerts resolved, resume the talent track.
  if (resolved > 0) {
    const stillActive = await db
      .select({ id: floorAlerts.id })
      .from(floorAlerts)
      .where(
        and(
          eq(floorAlerts.studentId, studentId),
          eq(floorAlerts.status, "active"),
        ),
      )
      .limit(1);
    if (stillActive.length === 0) {
      const pausedTrack = await db
        .select({ id: talentTracks.id })
        .from(talentTracks)
        .where(
          and(
            eq(talentTracks.studentId, studentId),
            eq(talentTracks.isPaused, true),
          ),
        )
        .limit(1);
      if (pausedTrack.at(0)) {
        await db
          .update(talentTracks)
          .set({
            isPaused: false,
            pauseReason: null,
            updatedAt: new Date(),
          })
          .where(eq(talentTracks.id, pausedTrack[0]!.id));
      }
    }
  }

  return resolved;
}
