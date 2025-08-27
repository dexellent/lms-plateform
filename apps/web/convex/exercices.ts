import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// === QUERIES ===

/**
 * Récupère tous les exercices d'un module
 */
export const getModuleExercises = query({
  args: {
    moduleId: v.id("modules"),
    includeSubmissions: v.optional(v.boolean()),
  },
  handler: async (ctx, { moduleId, includeSubmissions = false }) => {
    const identity = await ctx.auth.getUserIdentity();

    // Vérifier l'accès au module
    const module = await ctx.db.get(moduleId);
    if (!module) throw new Error("Module not found");

    const course = await ctx.db.get(module.courseId);
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

    // Récupérer les exercices
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_module", (q) => q.eq("moduleId", moduleId))
      .collect();

    if (!includeSubmissions || !currentUser) {
      return exercises;
    }

    // Enrichir avec les soumissions de l'utilisateur
    const exercisesWithSubmissions = await Promise.all(
      exercises.map(async (exercise) => {
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_student_exercise", (q) =>
            q.eq("studentId", currentUser!._id).eq("exerciseId", exercise._id)
          )
          .order("desc")
          .collect();

        const bestSubmission = submissions.length > 0
          ? submissions.reduce((best, current) =>
            (current.score || 0) > (best.score || 0) ? current : best
          )
          : null;

        return {
          ...exercise,
          submissions,
          bestSubmission,
          hasSubmitted: submissions.length > 0,
          attemptsUsed: submissions.length,
          attemptsRemaining: exercise.maxAttempts ? exercise.maxAttempts - submissions.length : null,
        };
      })
    );

    return exercisesWithSubmissions;
  },
});

/**
 * Récupère un exercice spécifique
 */
export const getExercise = query({
  args: {
    exerciseId: v.id("exercises"),
    includeSubmissions: v.optional(v.boolean()),
  },
  handler: async (ctx, { exerciseId, includeSubmissions = false }) => {
    const exercise = await ctx.db.get(exerciseId);
    if (!exercise) throw new Error("Exercise not found");

    // Vérifier l'accès
    const module = await ctx.db.get(exercise.moduleId);
    if (!module) throw new Error("Module not found");

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

    const canAccess = course.status === "published" ||
      currentUser?.role === "admin" ||
      (currentUser && course.instructorId === currentUser._id);

    if (!canAccess) {
      throw new Error("Access denied");
    }

    let submissions = null;
    let userStats = null;

    if (includeSubmissions && currentUser) {
      submissions = await ctx.db
        .query("submissions")
        .withIndex("by_student_exercise", (q) =>
          q.eq("studentId", currentUser._id).eq("exerciseId", exerciseId)
        )
        .order("desc")
        .collect();

      if (submissions.length > 0) {
        const bestScore = Math.max(...submissions.map(s => s.score || 0));
        const totalTimeSpent = submissions.reduce((acc, s) => acc + (s.timeSpent || 0), 0);

        userStats = {
          bestScore,
          totalAttempts: submissions.length,
          totalTimeSpent,
          averageScore: submissions.reduce((acc, s) => acc + (s.score || 0), 0) / submissions.length,
          hasPassingScore: exercise.passingScore ? bestScore >= exercise.passingScore : null,
        };
      }
    }

    return {
      ...exercise,
      module: {
        id: module._id,
        title: module.title,
        courseId: module.courseId,
      },
      course: {
        id: course._id,
        title: course.title,
      },
      submissions,
      userStats,
    };
  },
});

/**
 * Récupère les exercices générés par l'IA
 */
export const getAIGeneratedExercises = query({
  args: {
    courseId: v.optional(v.id("courses")),
    difficulty: v.optional(v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { courseId, difficulty, limit = 20 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");
    if (user.role !== "instructor" && user.role !== "admin") {
      throw new Error("Access denied");
    }

    let query = ctx.db
      .query("exercises")
      .withIndex("by_ai_generated", (q) => q.eq("aiGenerated", true));

    if (difficulty) {
      query = query.filter((q) => q.eq(q.field("difficulty"), difficulty));
    }

    const exercises = await query.take(limit);

    if (!courseId) {
      return exercises;
    }

    // Filtrer par cours si spécifié
    const filteredExercises = await Promise.all(
      exercises.map(async (exercise) => {
        const module = await ctx.db.get(exercise.moduleId);
        return module?.courseId === courseId ? exercise : null;
      })
    );

    return filteredExercises.filter(Boolean);
  },
});

/**
 * Statistiques des exercices pour les instructeurs
 */
export const getExerciseStats = query({
  args: {
    exerciseId: v.optional(v.id("exercises")),
    moduleId: v.optional(v.id("modules")),
    courseId: v.optional(v.id("courses")),
  },
  handler: async (ctx, { exerciseId, moduleId, courseId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");
    if (user.role !== "instructor" && user.role !== "admin") {
      throw new Error("Access denied");
    }

    let submissions;

    if (exerciseId) {
      // Stats pour un exercice spécifique
      submissions = await ctx.db
        .query("submissions")
        .withIndex("by_exercise", (q) => q.eq("exerciseId", exerciseId))
        .collect();
    } else if (moduleId) {
      // Stats pour tous les exercices d'un module
      const exercises = await ctx.db
        .query("exercises")
        .withIndex("by_module", (q) => q.eq("moduleId", moduleId))
        .collect();

      const allSubmissions = await Promise.all(
        exercises.map(async (exercise) => {
          return await ctx.db
            .query("submissions")
            .withIndex("by_exercise", (q) => q.eq("exerciseId", exercise._id))
            .collect();
        })
      );

      submissions = allSubmissions.flat();
    } else if (courseId) {
      // Stats pour tous les exercices d'un cours
      const modules = await ctx.db
        .query("modules")
        .withIndex("by_course", (q) => q.eq("courseId", courseId))
        .collect();

      const allExercises = await Promise.all(
        modules.map(async (module) => {
          return await ctx.db
            .query("exercises")
            .withIndex("by_module", (q) => q.eq("moduleId", module._id))
            .collect();
        })
      );

      const exercises = allExercises.flat();
      const allSubmissions = await Promise.all(
        exercises.map(async (exercise) => {
          return await ctx.db
            .query("submissions")
            .withIndex("by_exercise", (q) => q.eq("exerciseId", exercise._id))
            .collect();
        })
      );

      submissions = allSubmissions.flat();
    } else {
      throw new Error("Must specify exerciseId, moduleId, or courseId");
    }

    if (submissions.length === 0) {
      return {
        totalSubmissions: 0,
        uniqueStudents: 0,
        averageScore: 0,
        passRate: 0,
        averageAttempts: 0,
        averageTimeSpent: 0,
        difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
        statusDistribution: { submitted: 0, graded: 0, needs_review: 0 },
      };
    }

    const uniqueStudents = new Set(submissions.map(s => s.studentId)).size;
    const gradedSubmissions = submissions.filter(s => s.status === "graded" && s.score !== undefined);

    const averageScore = gradedSubmissions.length > 0
      ? gradedSubmissions.reduce((acc, s) => acc + (s.score || 0), 0) / gradedSubmissions.length
      : 0;

    // Calculer le taux de réussite (basé sur le score de passage)
    let passCount = 0;
    if (exerciseId) {
      const exercise = await ctx.db.get(exerciseId);
      if (exercise?.passingScore) {
        passCount = gradedSubmissions.filter(s => (s.score || 0) >= exercise.passingScore!).length;
      }
    }

    const passRate = gradedSubmissions.length > 0 ? (passCount / gradedSubmissions.length) * 100 : 0;

    // Calculer les tentatives par étudiant
    const studentAttempts = submissions.reduce((acc, s) => {
      acc[s.studentId] = (acc[s.studentId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageAttempts = Object.values(studentAttempts).reduce((acc, count) => acc + count, 0) / uniqueStudents;

    const averageTimeSpent = submissions
      .filter(s => s.timeSpent)
      .reduce((acc, s) => acc + (s.timeSpent || 0), 0) / submissions.filter(s => s.timeSpent).length;

    return {
      totalSubmissions: submissions.length,
      uniqueStudents,
      averageScore: Math.round(averageScore * 100) / 100,
      passRate: Math.round(passRate * 100) / 100,
      averageAttempts: Math.round(averageAttempts * 100) / 100,
      averageTimeSpent: Math.round(averageTimeSpent || 0),
      statusDistribution: {
        submitted: submissions.filter(s => s.status === "submitted").length,
        graded: submissions.filter(s => s.status === "graded").length,
        needs_review: submissions.filter(s => s.status === "needs_review").length,
      },
    };
  },
});

// === MUTATIONS ===

/**
 * Crée un nouvel exercice
 */
export const createExercise = mutation({
  args: {
    moduleId: v.id("modules"),
    title: v.string(),
    description: v.string(),
    type: v.union(
      v.literal("multiple_choice"),
      v.literal("open_ended"),
      v.literal("coding"),
      v.literal("file_upload")
    ),
    question: v.string(),
    options: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      isCorrect: v.optional(v.boolean()),
    }))),
    correctAnswer: v.optional(v.string()),
    maxAttempts: v.optional(v.number()),
    timeLimit: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    passingScore: v.optional(v.number()),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    tags: v.array(v.string()),
    aiGenerated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Vérifier l'accès au module
    const module = await ctx.db.get(args.moduleId);
    if (!module) throw new Error("Module not found");

    const course = await ctx.db.get(module.courseId);
    if (!course) throw new Error("Course not found");

    const canEdit = user.role === "admin" || course.instructorId === user._id;
    if (!canEdit) {
      throw new Error("Permission denied");
    }

    // Valider les données selon le type
    if (args.type === "multiple_choice" && (!args.options || args.options.length === 0)) {
      throw new Error("Multiple choice exercises must have options");
    }

    if (args.type === "multiple_choice" && !args.options?.some(opt => opt.isCorrect)) {
      throw new Error("Multiple choice exercises must have at least one correct answer");
    }

    const exerciseId = await ctx.db.insert("exercises", {
      ...args,
      maxScore: args.maxScore ?? 20,
      aiGenerated: args.aiGenerated ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return exerciseId;
  },
});

/**
 * Met à jour un exercice
 */
export const updateExercise = mutation({
  args: {
    exerciseId: v.id("exercises"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("multiple_choice"),
      v.literal("open_ended"),
      v.literal("coding"),
      v.literal("file_upload")
    )),
    question: v.optional(v.string()),
    options: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      isCorrect: v.optional(v.boolean()),
    }))),
    correctAnswer: v.optional(v.string()),
    maxAttempts: v.optional(v.number()),
    timeLimit: v.optional(v.number()),
    passingScore: v.optional(v.number()),
    difficulty: v.optional(v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { exerciseId, ...updates }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const exercise = await ctx.db.get(exerciseId);
    if (!exercise) throw new Error("Exercise not found");

    const module = await ctx.db.get(exercise.moduleId);
    if (!module) throw new Error("Module not found");

    const course = await ctx.db.get(module.courseId);
    if (!course) throw new Error("Course not found");

    const canEdit = user.role === "admin" || course.instructorId === user._id;
    if (!canEdit) {
      throw new Error("Permission denied");
    }

    // Valider les nouvelles données
    const newType = updates.type ?? exercise.type;
    const newOptions = updates.options ?? exercise.options;

    if (newType === "multiple_choice" && (!newOptions || newOptions.length === 0)) {
      throw new Error("Multiple choice exercises must have options");
    }

    if (newType === "multiple_choice" && !newOptions?.some(opt => opt.isCorrect)) {
      throw new Error("Multiple choice exercises must have at least one correct answer");
    }

    return await ctx.db.patch(exerciseId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Soumet une réponse à un exercice
 */
export const submitExercise = mutation({
  args: {
    exerciseId: v.id("exercises"),
    answer: v.string(),
    attachments: v.optional(v.array(v.string())),
    timeSpent: v.optional(v.number()),
  },
  handler: async (ctx, { exerciseId, answer, attachments, timeSpent }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");
    if (user.role !== "learner") {
      throw new Error("Only learners can submit exercises");
    }

    const exercise = await ctx.db.get(exerciseId);
    if (!exercise) throw new Error("Exercise not found");

    // Vérifier que l'utilisateur est inscrit au cours
    const module = await ctx.db.get(exercise.moduleId);
    if (!module) throw new Error("Module not found");

    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", user._id))
      .filter((q) => q.eq(q.field("courseId"), module.courseId))
      .unique();

    if (!enrollment || enrollment.status !== "active") {
      throw new Error("Not enrolled in this course or enrollment not active");
    }

    // Vérifier le nombre de tentatives
    if (exercise.maxAttempts) {
      const previousSubmissions = await ctx.db
        .query("submissions")
        .withIndex("by_student_exercise", (q) =>
          q.eq("studentId", user._id).eq("exerciseId", exerciseId)
        )
        .collect();

      if (previousSubmissions.length >= exercise.maxAttempts) {
        throw new Error("Maximum number of attempts reached");
      }
    }

    const attemptNumber = await ctx.db
      .query("submissions")
      .withIndex("by_student_exercise", (q) =>
        q.eq("studentId", user._id).eq("exerciseId", exerciseId)
      )
      .collect()
      .then(submissions => submissions.length + 1);

    // Calculer le score automatique pour les QCM
    let autoScore: number | undefined;
    let aiGradingResult: any;

    if (exercise.type === "multiple_choice" && exercise.options) {
      const correctOptions = exercise.options.filter(opt => opt.isCorrect);
      const submittedAnswers = answer.split(',').map(a => a.trim());

      const correctCount = submittedAnswers.filter(ans =>
        correctOptions.some(opt => opt.id === ans)
      ).length;

      const incorrectCount = submittedAnswers.filter(ans =>
        !correctOptions.some(opt => opt.id === ans)
      ).length;

      // Score simple : (bonnes réponses - mauvaises réponses) / total possible
      autoScore = Math.max(0, (correctCount - incorrectCount) / correctOptions.length) * exercise.maxScore;

      aiGradingResult = {
        score: autoScore,
        feedback: `${correctCount} bonnes réponses sur ${correctOptions.length}`,
        suggestions: incorrectCount > 0 ? ["Révisez les options sélectionnées"] : ["Excellent travail !"],
        confidence: 1.0, // Score automatique = confidence totale
      };
    }

    const submissionId = await ctx.db.insert("submissions", {
      exerciseId,
      studentId: user._id,
      answer,
      attachments: attachments ?? [],
      score: autoScore,
      maxScore: exercise.maxScore || 100,
      status: autoScore !== undefined ? "graded" : "submitted",
      aiGradingResult,
      attemptNumber,
      timeSpent: timeSpent ?? 0,
      submittedAt: Date.now(),
      gradedAt: autoScore !== undefined ? Date.now() : undefined,
    });

    // TODO: Si pas de score automatique, déclencher l'évaluation IA via l'API Go
    // Cela pourrait être fait via une action Convex qui appelle l'API externe

    return submissionId;
  },
});

/**
 * Note manuellement une soumission (instructeur)
 */
export const gradeSubmission = mutation({
  args: {
    submissionId: v.id("submissions"),
    score: v.number(),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, { submissionId, score, feedback }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");
    if (user.role !== "instructor" && user.role !== "admin") {
      throw new Error("Only instructors and admins can grade submissions");
    }

    const submission = await ctx.db.get(submissionId);
    if (!submission) throw new Error("Submission not found");

    const exercise = await ctx.db.get(submission.exerciseId);
    if (!exercise) throw new Error("Exercise not found");

    const module = await ctx.db.get(exercise.moduleId);
    if (!module) throw new Error("Module not found");

    const course = await ctx.db.get(module.courseId);
    if (!course) throw new Error("Course not found");

    const canGrade = user.role === "admin" || course.instructorId === user._id;
    if (!canGrade) {
      throw new Error("Permission denied");
    }

    // Valider le score
    if (score < 0 || score > submission.maxScore) {
      throw new Error(`Score must be between 0 and ${submission.maxScore}`);
    }

    return await ctx.db.patch(submissionId, {
      score,
      status: "graded",
      instructorFeedback: feedback,
      gradedAt: Date.now(),
    });
  },
});

/**
 * Génère un exercice avec l'IA (placeholder pour l'API Go)
 */
export const generateExerciseWithAI = mutation({
  args: {
    moduleId: v.id("modules"),
    topic: v.string(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    type: v.union(
      v.literal("multiple_choice"),
      v.literal("open_ended"),
      v.literal("coding")
    ),
    count: v.optional(v.number()),
  },
  handler: async (ctx, { moduleId, topic, difficulty, type, count = 1 }) => {
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

    const canGenerate = user.role === "admin" || course.instructorId === user._id;
    if (!canGenerate) {
      throw new Error("Permission denied");
    }

    // TODO: Appeler l'API Go pour générer les exercices
    // Pour l'instant, on crée un exercice placeholder

    const exerciseIds = [];

    for (let i = 0; i < count; i++) {
      let exerciseData: any = {
        moduleId,
        title: `${topic} - Exercice généré par IA ${i + 1}`,
        description: `Exercice généré automatiquement sur le sujet : ${topic}`,
        type,
        question: `Question générée par IA sur ${topic} (niveau ${difficulty})`,
        difficulty,
        tags: [topic, "ai-generated"],
        aiGenerated: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (type === "multiple_choice") {
        exerciseData.options = [
          { id: "a", text: "Option A (générée)", isCorrect: true },
          { id: "b", text: "Option B (générée)", isCorrect: false },
          { id: "c", text: "Option C (générée)", isCorrect: false },
          { id: "d", text: "Option D (générée)", isCorrect: false },
        ];
      }

      if (type === "open_ended" || type === "coding") {
        exerciseData.correctAnswer = "Réponse modèle générée par IA";
      }

      const exerciseId = await ctx.db.insert("exercises", exerciseData);
      exerciseIds.push(exerciseId);
    }

    return exerciseIds;
  },
});

/**
 * Duplique un exercice
 */
export const duplicateExercise = mutation({
  args: {
    exerciseId: v.id("exercises"),
    targetModuleId: v.optional(v.id("modules")),
    newTitle: v.optional(v.string()),
  },
  handler: async (ctx, { exerciseId, targetModuleId, newTitle }) => {
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

    const originalExercise = await ctx.db.get(exerciseId);
    if (!originalExercise) throw new Error("Exercise not found");

    const finalTargetModuleId = targetModuleId || originalExercise.moduleId;

    // Vérifier l'accès au module cible
    const targetModule = await ctx.db.get(finalTargetModuleId);
    if (!targetModule) throw new Error("Target module not found");

    const targetCourse = await ctx.db.get(targetModule.courseId);
    if (!targetCourse) throw new Error("Target course not found");

    const canEdit = user.role === "admin" || targetCourse.instructorId === user._id;
    if (!canEdit) {
      throw new Error("Permission denied");
    }

    // Créer le nouvel exercice
    const { _id, _creationTime, moduleId, createdAt, updatedAt, ...exerciseData } = originalExercise;

    const newExerciseId = await ctx.db.insert("exercises", {
      ...exerciseData,
      title: newTitle || `${originalExercise.title} (Copie)`,
      moduleId: finalTargetModuleId,
      aiGenerated: false, // Les copies ne sont plus considérées comme générées par IA
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return newExerciseId;
  },
});

/**
 * Supprime un exercice
 */
export const deleteExercise = mutation({
  args: {
    exerciseId: v.id("exercises"),
  },
  handler: async (ctx, { exerciseId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const exercise = await ctx.db.get(exerciseId);
    if (!exercise) throw new Error("Exercise not found");

    const module = await ctx.db.get(exercise.moduleId);
    if (!module) throw new Error("Module not found");

    const course = await ctx.db.get(module.courseId);
    if (!course) throw new Error("Course not found");

    const canDelete = user.role === "admin" || course.instructorId === user._id;
    if (!canDelete) {
      throw new Error("Permission denied");
    }

    // Supprimer toutes les soumissions associées
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_exercise", (q) => q.eq("exerciseId", exerciseId))
      .collect();

    for (const submission of submissions) {
      await ctx.db.delete(submission._id);
    }

    // Supprimer l'exercice
    return await ctx.db.delete(exerciseId);
  },
});

// === HELPERS ===

/**
 * Calcule le score d'un QCM
 */
function calculateMultipleChoiceScore(
  submittedAnswers: string[],
  correctOptions: { id: string; isCorrect?: boolean }[],
  maxScore: number
): number {
  const correctIds = correctOptions.filter(opt => opt.isCorrect).map(opt => opt.id);
  const correctCount = submittedAnswers.filter(ans => correctIds.includes(ans)).length;
  const incorrectCount = submittedAnswers.filter(ans => !correctIds.includes(ans)).length;

  // Formule : (bonnes réponses - mauvaises réponses) / total possible, minimum 0
  return Math.max(0, (correctCount - incorrectCount) / correctIds.length) * maxScore;
}
