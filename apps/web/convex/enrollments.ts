import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// === QUERIES ===

/**
 * Récupère les cours auxquels l'utilisateur est inscrit
 */
export const getMyEnrollments = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("completed"), v.literal("dropped"), v.literal("suspended"))),
  },
  handler: async (ctx, { status }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return [];

    let query = ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .order("desc");

    if (status) {
      query = query.filter((q) => q.eq(q.field("status"), status));
    }

    const enrollments = await query.collect();

    // Enrichir avec les informations du cours
    const enrichedEnrollments = await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = await ctx.db.get(enrollment.courseId);
        const instructor = course ? await ctx.db.get(course.instructorId) : null;

        return {
          ...enrollment,
          course: course ? {
            ...course,
            instructor: instructor ? {
              id: instructor._id,
              clerkId: instructor.clerkId,
              role: instructor.role,
            } : null,
          } : null,
        };
      })
    );

    return enrichedEnrollments.filter(e => e.course !== null);
  },
});

/**
 * Récupère une inscription spécifique
 */
export const getEnrollment = query({
  args: {
    courseId: v.id("courses"),
    studentClerkId: v.optional(v.string()),
  },
  handler: async (ctx, { courseId, studentClerkId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const targetClerkId = studentClerkId || identity.subject;

    const student = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", targetClerkId))
      .unique();

    if (!student) return null;

    // Vérifier les permissions
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const canAccess = currentUser?.role === "admin" ||
      currentUser?._id === student._id ||
      (currentUser?.role === "instructor" && await isInstructorOfCourse(ctx, currentUser._id, courseId));

    if (!canAccess) {
      throw new Error("Permission denied");
    }

    return await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .filter((q) => q.eq(q.field("courseId"), courseId))
      .unique();
  },
});

/**
 * Récupère le progrès détaillé d'une inscription
 */
export const getEnrollmentProgress = query({
  args: {
    enrollmentId: v.id("enrollments"),
  },
  handler: async (ctx, { enrollmentId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const enrollment = await ctx.db.get(enrollmentId);
    if (!enrollment) throw new Error("Enrollment not found");

    // Vérifier les permissions
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const canAccess = currentUser?.role === "admin" ||
      currentUser?._id === enrollment.studentId ||
      (currentUser?.role === "instructor" && await isInstructorOfCourse(ctx, currentUser._id, enrollment.courseId));

    if (!canAccess) {
      throw new Error("Permission denied");
    }

    // Récupérer le progrès des modules
    const moduleProgress = await ctx.db
      .query("moduleProgress")
      .withIndex("by_enrollment", (q) => q.eq("enrollmentId", enrollmentId))
      .collect();

    // Récupérer les modules du cours
    const modules = await ctx.db
      .query("modules")
      .withIndex("by_course", (q) => q.eq("courseId", enrollment.courseId))
      .collect();

    // Enrichir le progrès avec les informations des modules
    const enrichedProgress = await Promise.all(
      modules.map(async (module) => {
        const progress = moduleProgress.find(mp => mp.moduleId === module._id);
        return {
          module,
          progress: progress || {
            status: "not_started" as const,
            progressPercentage: 0,
            timeSpent: 0,
          },
        };
      })
    );

    return {
      enrollment,
      moduleProgress: enrichedProgress,
      overallStats: {
        totalModules: modules.length,
        completedModules: moduleProgress.filter(mp => mp.status === "completed").length,
        inProgressModules: moduleProgress.filter(mp => mp.status === "in_progress").length,
        totalTimeSpent: moduleProgress.reduce((acc, mp) => acc + mp.timeSpent, 0),
      },
    };
  },
});

/**
 * Récupère les inscriptions d'un cours (pour les instructeurs)
 */
export const getCourseEnrollments = query({
  args: {
    courseId: v.id("courses"),
    status: v.optional(v.union(v.literal("active"), v.literal("completed"), v.literal("dropped"), v.literal("suspended"))),
  },
  handler: async (ctx, { courseId, status }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) throw new Error("User not found");

    // Vérifier les permissions
    const canAccess = currentUser.role === "admin" ||
      await isInstructorOfCourse(ctx, currentUser._id, courseId);

    if (!canAccess) {
      throw new Error("Permission denied");
    }

    let query = ctx.db
      .query("enrollments")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .order("desc");

    if (status) {
      query = query.filter((q) => q.eq(q.field("status"), status));
    }

    const enrollments = await query.collect();

    // Enrichir avec les informations des étudiants
    const enrichedEnrollments = await Promise.all(
      enrollments.map(async (enrollment) => {
        const student = await ctx.db.get(enrollment.studentId);
        return {
          ...enrollment,
          student: student ? {
            id: student._id,
            clerkId: student.clerkId,
            role: student.role,
            preferences: student.preferences,
          } : null,
        };
      })
    );

    return enrichedEnrollments.filter(e => e.student !== null);
  },
});

/**
 * Statistiques d'inscription pour les instructeurs
 */
export const getEnrollmentStats = query({
  args: {
    courseId: v.optional(v.id("courses")),
  },
  handler: async (ctx, { courseId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) throw new Error("User not found");

    let enrollments;

    if (courseId) {
      // Stats pour un cours spécifique
      const canAccess = currentUser.role === "admin" ||
        await isInstructorOfCourse(ctx, currentUser._id, courseId);

      if (!canAccess) {
        throw new Error("Permission denied");
      }

      enrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_course", (q) => q.eq("courseId", courseId))
        .collect();
    } else {
      // Stats globales pour un instructeur
      if (currentUser.role === "admin") {
        enrollments = await ctx.db.query("enrollments").collect();
      } else if (currentUser.role === "instructor") {
        const courses = await ctx.db
          .query("courses")
          .withIndex("by_instructor", (q) => q.eq("instructorId", currentUser._id))
          .collect();

        const allEnrollments = await Promise.all(
          courses.map(async (course) => {
            return await ctx.db
              .query("enrollments")
              .withIndex("by_course", (q) => q.eq("courseId", course._id))
              .collect();
          })
        );

        enrollments = allEnrollments.flat();
      } else {
        throw new Error("Permission denied");
      }
    }

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    return {
      total: enrollments.length,
      byStatus: {
        active: enrollments.filter(e => e.status === "active").length,
        completed: enrollments.filter(e => e.status === "completed").length,
        dropped: enrollments.filter(e => e.status === "dropped").length,
        suspended: enrollments.filter(e => e.status === "suspended").length,
      },
      recentActivity: {
        newEnrollmentsLastWeek: enrollments.filter(e => e.enrolledAt > oneWeekAgo).length,
        newEnrollmentsLastMonth: enrollments.filter(e => e.enrolledAt > oneMonthAgo).length,
        completionsLastWeek: enrollments.filter(e =>
          e.status === "completed" && e.completedAt && e.completedAt > oneWeekAgo
        ).length,
      },
      averageProgress: enrollments.filter(e => e.status === "active").length > 0
        ? enrollments
          .filter(e => e.status === "active")
          .reduce((acc, e) => acc + e.progressPercentage, 0) /
        enrollments.filter(e => e.status === "active").length
        : 0,
    };
  },
});

// === MUTATIONS ===

/**
 * S'inscrire à un cours
 */
export const enrollInCourse = mutation({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, { courseId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");
    if (user.role !== "learner") {
      throw new Error("Only learners can enroll in courses");
    }

    // Vérifier que le cours existe et est publié
    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found");
    if (course.status !== "published") {
      throw new Error("Course is not available for enrollment");
    }

    // Vérifier que l'utilisateur n'est pas déjà inscrit
    const existingEnrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .filter((q) => q.eq(q.field("courseId"), courseId))
      .unique();

    if (existingEnrollment) {
      if (existingEnrollment.status === "dropped") {
        // Réactiver l'inscription
        await ctx.db.patch(existingEnrollment._id, {
          status: "active",
          enrolledAt: Date.now(),
          progressPercentage: 0,
          completedModules: [],
          currentModuleId: undefined,
        });
        return existingEnrollment._id;
      } else {
        throw new Error("Already enrolled in this course");
      }
    }

    // Créer l'inscription
    const enrollmentId = await ctx.db.insert("enrollments", {
      courseId,
      studentId: user._id,
      status: "active",
      enrolledAt: Date.now(),
      progressPercentage: 0,
      completedModules: [],
      totalTimeSpent: 0,
    });

    // Mettre à jour le compteur d'inscriptions du cours
    await ctx.db.patch(courseId, {
      enrollmentCount: (course.enrollmentCount || 0) + 1,
    });

    // Initialiser le progrès pour tous les modules
    const modules = await ctx.db
      .query("modules")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();

    for (const module of modules) {
      await ctx.db.insert("moduleProgress", {
        enrollmentId,
        moduleId: module._id,
        studentId: user._id,
        status: "not_started",
        progressPercentage: 0,
        timeSpent: 0,
      });
    }

    return enrollmentId;
  },
});

/**
 * Mettre à jour le progrès d'un module
 */
export const updateModuleProgress = mutation({
  args: {
    moduleId: v.id("modules"),
    progressPercentage: v.number(),
    timeSpent: v.number(),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, { moduleId, progressPercentage, timeSpent, completed = false }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Récupérer le module et le cours
    const module = await ctx.db.get(moduleId);
    if (!module) throw new Error("Module not found");

    // Récupérer l'inscription
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .filter((q) => q.eq(q.field("courseId"), module.courseId))
      .unique();

    if (!enrollment || enrollment.status !== "active") {
      throw new Error("Not enrolled in this course or enrollment not active");
    }

    // Récupérer ou créer le progrès du module
    let moduleProgress = await ctx.db
      .query("moduleProgress")
      .withIndex("by_student_module", (q) => q.eq("studentId", user._id).eq("moduleId", moduleId))
      .unique();

    if (!moduleProgress) {
      // Créer le progrès si il n'existe pas
      const progressId = await ctx.db.insert("moduleProgress", {
        enrollmentId: enrollment._id,
        moduleId,
        studentId: user._id,
        status: "not_started",
        progressPercentage: 0,
        timeSpent: 0,
      });
      moduleProgress = await ctx.db.get(progressId);
    }

    if (!moduleProgress) throw new Error("Failed to create module progress");

    // Déterminer le nouveau statut
    let newStatus: "not_started" | "in_progress" | "completed" = moduleProgress.status;

    if (completed || progressPercentage >= 100) {
      newStatus = "completed";
      progressPercentage = 100;

      if (!moduleProgress.completedAt) {
        // Première fois qu'il complète ce module
        await ctx.db.patch(moduleProgress._id, {
          completedAt: Date.now(),
        });

        // Ajouter à la liste des modules complétés de l'inscription
        const updatedCompletedModules = [...enrollment.completedModules];
        if (!updatedCompletedModules.includes(moduleId)) {
          updatedCompletedModules.push(moduleId);
        }

        await ctx.db.patch(enrollment._id, {
          completedModules: updatedCompletedModules,
        });
      }
    } else if (progressPercentage > 0) {
      newStatus = "in_progress";

      if (!moduleProgress.startedAt) {
        await ctx.db.patch(moduleProgress._id, {
          startedAt: Date.now(),
        });
      }
    }

    // Mettre à jour le progrès du module
    await ctx.db.patch(moduleProgress._id, {
      status: newStatus,
      progressPercentage: Math.min(progressPercentage, 100),
      timeSpent: moduleProgress.timeSpent + timeSpent,
      lastAccessedAt: Date.now(),
    });

    // Recalculer le progrès global de l'inscription
    await recalculateEnrollmentProgress(ctx, enrollment._id);

    return moduleProgress._id;
  },
});

/**
 * Abandonner un cours
 */
export const dropCourse = mutation({
  args: {
    courseId: v.id("courses"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { courseId, reason }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .filter((q) => q.eq(q.field("courseId"), courseId))
      .unique();

    if (!enrollment) throw new Error("Not enrolled in this course");
    if (enrollment.status !== "active") {
      throw new Error("Enrollment is not active");
    }

    await ctx.db.patch(enrollment._id, {
      status: "dropped",
    });

    return enrollment._id;
  },
});

// === HELPERS ===

/**
 * Vérifie si un utilisateur est instructeur d'un cours
 */
async function isInstructorOfCourse(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  courseId: Id<"courses">
): Promise<boolean> {
  const course = await ctx.db.get(courseId);
  return course?.instructorId === userId;
}

/**
 * Recalcule le progrès global d'une inscription
 */
async function recalculateEnrollmentProgress(
  ctx: MutationCtx,
  enrollmentId: Id<"enrollments">
) {
  const enrollment = await ctx.db.get(enrollmentId);
  if (!enrollment) return;

  // Récupérer tous les modules du cours
  const modules = await ctx.db
    .query("modules")
    .withIndex("by_course", (q) => q.eq("courseId", enrollment.courseId))
    .collect();

  if (modules.length === 0) return;

  // Récupérer le progrès de tous les modules
  const moduleProgresses = await ctx.db
    .query("moduleProgress")
    .withIndex("by_enrollment", (q) => q.eq("enrollmentId", enrollmentId))
    .collect();

  // Calculer le progrès global
  const totalProgress = moduleProgresses.reduce((acc, mp) => acc + mp.progressPercentage, 0);
  const averageProgress = totalProgress / modules.length;

  // Calculer le temps total
  const totalTimeSpent = moduleProgresses.reduce((acc, mp) => acc + mp.timeSpent, 0);

  // Vérifier si le cours est terminé
  const completedModules = moduleProgresses.filter(mp => mp.status === "completed").length;
  const isCompleted = completedModules === modules.length;

  // Trouver le module actuel (premier module non terminé)
  const currentModule = modules
    .sort((a, b) => a.order - b.order)
    .find(m => {
      const progress = moduleProgresses.find(mp => mp.moduleId === m._id);
      return !progress || progress.status !== "completed";
    });

  const updateData: {
    progressPercentage: number;
    totalTimeSpent: number;
    currentModuleId?: Id<"modules">;
    status?: "completed";
    completedAt?: number;
  } = {
    progressPercentage: Math.round(averageProgress),
    totalTimeSpent: Math.round(totalTimeSpent / 60), // Convertir en minutes
    currentModuleId: currentModule?._id,
  };

  if (isCompleted && enrollment.status === "active") {
    updateData.status = "completed";
    updateData.completedAt = Date.now();
  }

  await ctx.db.patch(enrollmentId, updateData);
}
