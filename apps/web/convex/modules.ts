import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// === QUERIES ===

/**
 * Récupère tous les modules d'un cours
 */
export const getCourseModules = query({
  args: {
    courseId: v.id("courses"),
    includeProgress: v.optional(v.boolean()),
  },
  handler: async (ctx, { courseId, includeProgress = false }) => {
    const identity = await ctx.auth.getUserIdentity();

    // Vérifier l'accès au cours
    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found");

    let currentUser = null;
    if (identity) {
      currentUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();
    }

    // Vérifier les permissions
    const canAccess = course.status === "published" ||
      currentUser?.role === "admin" ||
      (currentUser && course.instructorId === currentUser._id);

    if (!canAccess) {
      throw new Error("Access denied");
    }

    // Récupérer les modules
    const modules = await ctx.db
      .query("modules")
      .withIndex("by_course_order", (q) => q.eq("courseId", courseId))
      .order("asc")
      .collect();

    if (!includeProgress || !currentUser) {
      return modules;
    }

    // Enrichir avec le progrès de l'utilisateur si demandé
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", currentUser._id))
      .filter((q) => q.eq(q.field("courseId"), courseId))
      .unique();

    if (!enrollment) {
      return modules.map(module => ({ ...module, progress: null }));
    }

    const modulesWithProgress = await Promise.all(
      modules.map(async (module) => {
        const progress = await ctx.db
          .query("moduleProgress")
          .withIndex("by_student_module", (q) =>
            q.eq("studentId", currentUser!._id).eq("moduleId", module._id)
          )
          .unique();

        return {
          ...module,
          progress: progress || {
            status: "not_started" as const,
            progressPercentage: 0,
            timeSpent: 0,
          },
        };
      })
    );

    return modulesWithProgress;
  },
});

/**
 * Récupère un module spécifique avec ses exercices
 */
export const getModuleWithExercises = query({
  args: {
    moduleId: v.id("modules"),
    includeProgress: v.optional(v.boolean()),
  },
  handler: async (ctx, { moduleId, includeProgress = false }) => {
    const module = await ctx.db.get(moduleId);
    if (!module) throw new Error("Module not found");

    // Vérifier l'accès au cours
    const course = await ctx.db.get(module.courseId);
    if (!course) throw new Error("Course not found");

    const identity = await ctx.auth.getUserIdentity();
    let currentUser = null;
    if (identity) {
      currentUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .unique();
    }

    // Vérifier les permissions
    const canAccess = course.status === "published" ||
      currentUser?.role === "admin" ||
      (currentUser && course.instructorId === currentUser._id);

    if (!canAccess) {
      throw new Error("Access denied");
    }

    // Récupérer les exercices du module
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_module", (q) => q.eq("moduleId", moduleId))
      .collect();

    let progress = null;
    let exerciseSubmissions = null;

    if (includeProgress && currentUser) {
      // Récupérer le progrès du module
      progress = await ctx.db
        .query("moduleProgress")
        .withIndex("by_student_module", (q) =>
          q.eq("studentId", currentUser._id).eq("moduleId", moduleId)
        )
        .unique();

      // Récupérer les soumissions d'exercices
      const submissions = await Promise.all(
        exercises.map(async (exercise) => {
          const submission = await ctx.db
            .query("submissions")
            .withIndex("by_student_exercise", (q) =>
              q.eq("studentId", currentUser!._id).eq("exerciseId", exercise._id)
            )
            .order("desc")
            .first(); // Dernière soumission

          return {
            exerciseId: exercise._id,
            submission,
          };
        })
      );

      exerciseSubmissions = submissions.reduce((acc, { exerciseId, submission }) => {
        acc[exerciseId] = submission;
        return acc;
      }, {} as Record<string, any>);
    }

    return {
      ...module,
      course: {
        id: course._id,
        title: course.title,
        instructorId: course.instructorId,
      },
      exercises,
      progress,
      exerciseSubmissions,
    };
  },
});

/**
 * Récupère les modules d'un instructeur (tous cours confondus)
 */
export const getInstructorModules = query({
  args: {
    includeStats: v.optional(v.boolean()),
  },
  handler: async (ctx, { includeStats = false }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) throw new Error("User not found");
    if (currentUser.role !== "instructor" && currentUser.role !== "admin") {
      throw new Error("Access denied");
    }

    // Récupérer les cours de l'instructeur
    let courses;
    if (currentUser.role === "admin") {
      courses = await ctx.db.query("courses").collect();
    } else {
      courses = await ctx.db
        .query("courses")
        .withIndex("by_instructor", (q) => q.eq("instructorId", currentUser._id))
        .collect();
    }

    // Récupérer tous les modules
    const allModules = await Promise.all(
      courses.map(async (course) => {
        const modules = await ctx.db
          .query("modules")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();

        return modules.map(module => ({
          ...module,
          course: {
            id: course._id,
            title: course.title,
            status: course.status,
          },
        }));
      })
    );

    const modules = allModules.flat();

    if (!includeStats) {
      return modules;
    }

    // Ajouter les statistiques
    const modulesWithStats = await Promise.all(
      modules.map(async (module) => {
        const moduleProgresses = await ctx.db
          .query("moduleProgress")
          .withIndex("by_module", (q) => q.eq("moduleId", module._id))
          .collect();

        const completedCount = moduleProgresses.filter(mp => mp.status === "completed").length;
        const inProgressCount = moduleProgresses.filter(mp => mp.status === "in_progress").length;
        const averageProgress = moduleProgresses.length > 0
          ? moduleProgresses.reduce((acc, mp) => acc + mp.progressPercentage, 0) / moduleProgresses.length
          : 0;

        return {
          ...module,
          stats: {
            totalStudents: moduleProgresses.length,
            completedCount,
            inProgressCount,
            averageProgress: Math.round(averageProgress),
            averageTimeSpent: moduleProgresses.length > 0
              ? Math.round(moduleProgresses.reduce((acc, mp) => acc + mp.timeSpent, 0) / moduleProgresses.length)
              : 0,
          },
        };
      })
    );

    return modulesWithStats;
  },
});

// === MUTATIONS ===

/**
 * Crée un nouveau module
 */
export const createModule = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    type: v.union(
      v.literal("lesson"),
      v.literal("exercise"),
      v.literal("quiz"),
      v.literal("assignment")
    ),
    content: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    attachments: v.optional(v.array(v.string())),
    estimatedDuration: v.optional(v.number()),
    isRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Vérifier l'accès au cours
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found");

    const canEdit = user.role === "admin" || course.instructorId === user._id;
    if (!canEdit) {
      throw new Error("Permission denied");
    }

    // Déterminer l'ordre du module
    const existingModules = await ctx.db
      .query("modules")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const nextOrder = existingModules.length > 0
      ? Math.max(...existingModules.map(m => m.order)) + 1
      : 1;

    const moduleId = await ctx.db.insert("modules", {
      ...args,
      order: nextOrder,
      isRequired: args.isRequired ?? true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Créer le progrès pour tous les étudiants inscrits
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const enrollment of enrollments) {
      await ctx.db.insert("moduleProgress", {
        enrollmentId: enrollment._id,
        moduleId,
        studentId: enrollment.studentId,
        status: "not_started",
        progressPercentage: 0,
        timeSpent: 0,
      });
    }

    return moduleId;
  },
});

/**
 * Met à jour un module
 */
export const updateModule = mutation({
  args: {
    moduleId: v.id("modules"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("lesson"),
      v.literal("exercise"),
      v.literal("quiz"),
      v.literal("assignment")
    )),
    content: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    attachments: v.optional(v.array(v.string())),
    estimatedDuration: v.optional(v.number()),
    isRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, { moduleId, ...updates }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const module = await ctx.db.get(moduleId);
    if (!module) throw new Error("Module not found");

    const course = await ctx.db.get(module.courseId);
    if (!course) throw new Error("Course not found");

    const canEdit = user.role === "admin" || course.instructorId === user._id;
    if (!canEdit) {
      throw new Error("Permission denied");
    }

    return await ctx.db.patch(moduleId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Réorganise l'ordre des modules
 */
export const reorderModules = mutation({
  args: {
    moduleIds: v.array(v.id("modules")),
  },
  handler: async (ctx, { moduleIds }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Vérifier que tous les modules appartiennent au même cours
    const modules = await Promise.all(
      moduleIds.map(id => ctx.db.get(id))
    );

    const validModules = modules.filter(Boolean);
    if (validModules.length !== moduleIds.length) {
      throw new Error("Some modules not found");
    }

    const courseId = validModules[0]!.courseId;
    if (!validModules.every(m => m!.courseId === courseId)) {
      throw new Error("All modules must belong to the same course");
    }

    // Vérifier les permissions
    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found");

    const canEdit = user.role === "admin" || course.instructorId === user._id;
    if (!canEdit) {
      throw new Error("Permission denied");
    }

    // Mettre à jour l'ordre
    await Promise.all(
      moduleIds.map(async (moduleId, index) => {
        await ctx.db.patch(moduleId, {
          order: index + 1,
          updatedAt: Date.now(),
        });
      })
    );

    return moduleIds;
  },
});

/**
 * Duplique un module
 */
export const duplicateModule = mutation({
  args: {
    moduleId: v.id("modules"),
    targetCourseId: v.optional(v.id("courses")),
    newTitle: v.optional(v.string()),
  },
  handler: async (ctx, { moduleId, targetCourseId, newTitle }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");
    if (user.role !== "instructor" && user.role !== "admin") {
      throw new Error("Permission denied");
    }

    const originalModule = await ctx.db.get(moduleId);
    if (!originalModule) throw new Error("Module not found");

    const finalTargetCourseId = targetCourseId || originalModule.courseId;

    // Vérifier l'accès au cours cible
    const targetCourse = await ctx.db.get(finalTargetCourseId);
    if (!targetCourse) throw new Error("Target course not found");

    const canEdit = user.role === "admin" || targetCourse.instructorId === user._id;
    if (!canEdit) {
      throw new Error("Permission denied");
    }

    // Déterminer l'ordre du nouveau module
    const existingModules = await ctx.db
      .query("modules")
      .withIndex("by_course", (q) => q.eq("courseId", finalTargetCourseId))
      .collect();

    const nextOrder = existingModules.length > 0
      ? Math.max(...existingModules.map(m => m.order)) + 1
      : 1;

    // Créer le nouveau module
    const { _id, _creationTime, courseId, order, createdAt, updatedAt, ...moduleData } = originalModule;

    const newModuleId = await ctx.db.insert("modules", {
      ...moduleData,
      title: newTitle || `${originalModule.title} (Copie)`,
      courseId: finalTargetCourseId,
      order: nextOrder,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Dupliquer les exercices associés
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_module", (q) => q.eq("moduleId", moduleId))
      .collect();

    for (const exercise of exercises) {
      const { _id, _creationTime, moduleId: _, createdAt, updatedAt, ...exerciseData } = exercise;
      await ctx.db.insert("exercises", {
        ...exerciseData,
        moduleId: newModuleId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return newModuleId;
  },
});

/**
 * Supprime un module
 */
export const deleteModule = mutation({
  args: {
    moduleId: v.id("modules"),
  },
  handler: async (ctx, { moduleId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const module = await ctx.db.get(moduleId);
    if (!module) throw new Error("Module not found");

    const course = await ctx.db.get(module.courseId);
    if (!course) throw new Error("Course not found");

    const canDelete = user.role === "admin" || course.instructorId === user._id;
    if (!canDelete) {
      throw new Error("Permission denied");
    }

    // Supprimer les exercices associés
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_module", (q) => q.eq("moduleId", moduleId))
      .collect();

    for (const exercise of exercises) {
      // Supprimer les soumissions d'exercices
      const submissions = await ctx.db
        .query("submissions")
        .withIndex("by_exercise", (q) => q.eq("exerciseId", exercise._id))
        .collect();

      for (const submission of submissions) {
        await ctx.db.delete(submission._id);
      }

      await ctx.db.delete(exercise._id);
    }

    // Supprimer les progrès du module
    const moduleProgresses = await ctx.db
      .query("moduleProgress")
      .withIndex("by_module", (q) => q.eq("moduleId", moduleId))
      .collect();

    for (const progress of moduleProgresses) {
      await ctx.db.delete(progress._id);
    }

    // Mettre à jour les inscriptions (retirer le module des modules complétés)
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_course", (q) => q.eq("courseId", module.courseId))
      .collect();

    for (const enrollment of enrollments) {
      if (enrollment.completedModules.includes(moduleId)) {
        const updatedCompletedModules = enrollment.completedModules.filter(id => id !== moduleId);
        await ctx.db.patch(enrollment._id, {
          completedModules: updatedCompletedModules,
        });
      }

      if (enrollment.currentModuleId === moduleId) {
        await ctx.db.patch(enrollment._id, {
          currentModuleId: undefined,
        });
      }
    }

    // Supprimer le module
    await ctx.db.delete(moduleId);

    // Réorganiser l'ordre des modules restants
    const remainingModules = await ctx.db
      .query("modules")
      .withIndex("by_course_order", (q) => q.eq("courseId", module.courseId))
      .order("asc")
      .collect();

    await Promise.all(
      remainingModules.map(async (mod, index) => {
        await ctx.db.patch(mod._id, {
          order: index + 1,
        });
      })
    );

    return moduleId;
  },
});

// === HELPERS ===

/**
 * Vérifie si un utilisateur peut accéder à un module
 */
async function canAccessModule(
  ctx: QueryCtx,
  moduleId: Id<"modules">,
  userId?: Id<"users">
): Promise<boolean> {
  const module = await ctx.db.get(moduleId);
  if (!module) return false;

  const course = await ctx.db.get(module.courseId);
  if (!course) return false;

  // Cours public
  if (course.status === "published") return true;

  // Pas d'utilisateur connecté
  if (!userId) return false;

  const user = await ctx.db.get(userId);
  if (!user) return false;

  // Admin ou instructeur du cours
  return user.role === "admin" || course.instructorId === userId;
}
