import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // === UTILISATEURS (INTÉGRATION CLERK) ===
  users: defineTable({
    // Clerk Integration
    clerkId: v.string(), // Clerk User ID

    // Informations complémentaires (Clerk gère email, name, avatar via son API)
    role: v.union(v.literal("admin"), v.literal("instructor"), v.literal("learner")),

    // Métadonnées spécifiques à la plateforme
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
    isActive: v.boolean(),

    // Préférences utilisateur spécifiques au LMS
    preferences: v.object({
      language: v.string(),
      timezone: v.string(),
      emailNotifications: v.boolean(),
      aiTutorEnabled: v.boolean(),
      studyReminders: v.boolean(),
      difficultyPreference: v.union(v.literal("adaptive"), v.literal("easy"), v.literal("medium"), v.literal("hard")),
    }),

    // Profil pédagogique
    learningProfile: v.optional(v.object({
      learningStyle: v.union(v.literal("visual"), v.literal("auditory"), v.literal("kinesthetic"), v.literal("mixed")),
      preferredPace: v.union(v.literal("slow"), v.literal("normal"), v.literal("fast")),
      strengths: v.array(v.string()),
      improvementAreas: v.array(v.string()),
    })),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_role", ["role"])
    .index("by_active", ["isActive"]),

  // === COURS ET CONTENU ===
  courses: defineTable({
    title: v.string(),
    description: v.string(),
    thumbnail: v.optional(v.string()),
    instructorId: v.id("users"),

    // Structure et organisation
    category: v.string(),
    level: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
    estimatedDuration: v.number(), // en heures

    // Statut et dates
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),

    // Métadonnées pour l'IA
    tags: v.array(v.string()),
    learningObjectives: v.array(v.string()),
    prerequisites: v.array(v.string()),

    // Statistiques
    enrollmentCount: v.optional(v.number()),
    averageRating: v.optional(v.number()),
  })
    .index("by_instructor", ["instructorId"])
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .index("by_published", ["status", "publishedAt"]),

  modules: defineTable({
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),

    // Contenu
    type: v.union(
      v.literal("lesson"),
      v.literal("exercise"),
      v.literal("quiz"),
      v.literal("assignment")
    ),
    content: v.optional(v.string()), // Contenu en markdown/HTML
    videoUrl: v.optional(v.string()),
    attachments: v.optional(v.array(v.string())),

    // Métadonnées
    estimatedDuration: v.optional(v.number()), // en minutes
    isRequired: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_course", ["courseId"])
    .index("by_course_order", ["courseId", "order"]),

  // === ÉVALUATIONS ET EXERCICES ===
  exercises: defineTable({
    moduleId: v.id("modules"),
    title: v.string(),
    description: v.string(),
    type: v.union(
      v.literal("multiple_choice"),
      v.literal("open_ended"),
      v.literal("coding"),
      v.literal("file_upload")
    ),

    // Configuration
    maxAttempts: v.optional(v.number()),
    timeLimit: v.optional(v.number()), // en minutes
    maxScore: v.number(),
    passingScore: v.optional(v.number()),

    // Contenu de l'exercice
    question: v.string(),
    options: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      isCorrect: v.optional(v.boolean()),
    }))),
    correctAnswer: v.optional(v.string()),

    // Métadonnées pour l'IA
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    tags: v.array(v.string()),
    aiGenerated: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_module", ["moduleId"])
    .index("by_ai_generated", ["aiGenerated"])
    .index("by_difficulty", ["difficulty"]),

  submissions: defineTable({
    exerciseId: v.id("exercises"),
    studentId: v.id("users"),

    // Contenu de la soumission
    answer: v.string(),
    attachments: v.optional(v.array(v.string())),

    // Évaluation
    score: v.optional(v.number()),
    maxScore: v.number(),
    status: v.union(
      v.literal("submitted"),
      v.literal("graded"),
      v.literal("needs_review")
    ),

    // Feedback automatique et humain
    aiGradingResult: v.optional(v.object({
      score: v.number(),
      feedback: v.string(),
      suggestions: v.array(v.string()),
      confidence: v.number(), // 0-1
    })),
    instructorFeedback: v.optional(v.string()),

    // Métadonnées
    attemptNumber: v.number(),
    timeSpent: v.optional(v.number()), // en secondes
    submittedAt: v.number(),
    gradedAt: v.optional(v.number()),
  })
    .index("by_exercise", ["exerciseId"])
    .index("by_student", ["studentId"])
    .index("by_status", ["status"])
    .index("by_student_exercise", ["studentId", "exerciseId"]),

  // === INSCRIPTIONS ET PROGRÈS ===
  enrollments: defineTable({
    courseId: v.id("courses"),
    studentId: v.id("users"),

    // Statut et dates
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("dropped"),
      v.literal("suspended")
    ),
    enrolledAt: v.number(),
    completedAt: v.optional(v.number()),
    lastAccessedAt: v.optional(v.number()),

    // Progrès
    progressPercentage: v.number(),
    completedModules: v.array(v.id("modules")),
    currentModuleId: v.optional(v.id("modules")),

    // Statistiques
    totalTimeSpent: v.number(), // en minutes
    averageScore: v.optional(v.number()),
  })
    .index("by_course", ["courseId"])
    .index("by_student", ["studentId"])
    .index("by_status", ["status"])
    .index("by_student_status", ["studentId", "status"]),

  moduleProgress: defineTable({
    enrollmentId: v.id("enrollments"),
    moduleId: v.id("modules"),
    studentId: v.id("users"),

    // Progrès détaillé
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
    progressPercentage: v.number(),
    timeSpent: v.number(), // en minutes

    // Dates
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    lastAccessedAt: v.optional(v.number()),

    // Score si applicable
    score: v.optional(v.number()),
    maxScore: v.optional(v.number()),
  })
    .index("by_enrollment", ["enrollmentId"])
    .index("by_student", ["studentId"])
    .index("by_module", ["moduleId"])
    .index("by_student_module", ["studentId", "moduleId"]),

  // === FONCTIONNALITÉS IA ===
  aiTutorSessions: defineTable({
    studentId: v.id("users"),
    courseId: v.optional(v.id("courses")),
    moduleId: v.optional(v.id("modules")),

    // Session info
    sessionId: v.string(), // UUID pour tracer avec l'API Go
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("terminated")),

    // Contexte
    topic: v.string(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    learningStyle: v.optional(v.string()),

    // Métadonnées
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    messageCount: v.number(),
    satisfactionRating: v.optional(v.number()), // 1-5
  })
    .index("by_student", ["studentId"])
    .index("by_course", ["courseId"])
    .index("by_session", ["sessionId"])
    .index("by_status", ["status"]),

  aiTutorMessages: defineTable({
    sessionId: v.string(),
    studentId: v.id("users"),

    // Message
    sender: v.union(v.literal("student"), v.literal("ai_tutor")),
    content: v.string(),
    messageType: v.union(
      v.literal("text"),
      v.literal("code"),
      v.literal("explanation"),
      v.literal("hint"),
      v.literal("exercise_generation")
    ),

    // Métadonnées
    timestamp: v.number(),
    confidence: v.optional(v.number()), // Pour les réponses IA
    relevanceScore: v.optional(v.number()), // Pour améliorer l'IA
  })
    .index("by_session", ["sessionId"])
    .index("by_student", ["studentId"])
    .index("by_timestamp", ["timestamp"]),

  recommendations: defineTable({
    studentId: v.id("users"),

    // Recommandation
    type: v.union(
      v.literal("course"),
      v.literal("module"),
      v.literal("exercise"),
      v.literal("review_topic")
    ),
    targetId: v.string(), // ID de l'élément recommandé
    title: v.string(),
    description: v.string(),

    // Score et raisons
    relevanceScore: v.number(), // 0-1
    reasons: v.array(v.string()),

    // Métadonnées
    algorithmVersion: v.string(),
    generatedAt: v.number(),
    expiresAt: v.optional(v.number()),

    // Interaction
    viewed: v.boolean(),
    clicked: v.boolean(),
    dismissed: v.boolean(),
    feedback: v.optional(v.object({
      helpful: v.boolean(),
      comment: v.optional(v.string()),
    })),
  })
    .index("by_student", ["studentId"])
    .index("by_type", ["type"])
    .index("by_student_type", ["studentId", "type"])
    .index("by_relevance", ["relevanceScore"]),

  // === ANALYTICS ET LOGGING ===
  learningAnalytics: defineTable({
    studentId: v.id("users"),
    courseId: v.optional(v.id("courses")),

    // Métriques d'engagement
    dailyActiveTime: v.number(), // en minutes
    weeklyActiveTime: v.number(),
    monthlyActiveTime: v.number(),

    // Patterns d'apprentissage
    preferredStudyTimes: v.array(v.number()), // heures de la journée
    averageSessionDuration: v.number(),
    streakDays: v.number(),

    // Performance
    averageScore: v.number(),
    improvementRate: v.number(), // % d'amélioration
    strugglingTopics: v.array(v.string()),
    strongTopics: v.array(v.string()),

    // Date de calcul
    calculatedAt: v.number(),
    periodStart: v.number(),
    periodEnd: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_course", ["courseId"])
    .index("by_calculated", ["calculatedAt"]),

  // === NOTIFICATIONS ===
  notifications: defineTable({
    userId: v.id("users"),

    // Contenu
    type: v.union(
      v.literal("course_update"),
      v.literal("assignment_due"),
      v.literal("ai_recommendation"),
      v.literal("achievement"),
      v.literal("system")
    ),
    title: v.string(),
    message: v.string(),
    actionUrl: v.optional(v.string()),

    // Métadonnées
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    read: v.boolean(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),

    // Données contextuelles
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_read", ["read"])
    .index("by_user_unread", ["userId", "read"])
    .index("by_priority", ["priority"]),
});
