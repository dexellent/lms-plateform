import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// === QUERIES ===

/**
 * Récupère l'utilisateur actuel avec ses données Clerk + LMS
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return null;

    // Combiner les données Clerk et LMS
    return {
      ...user,
      name: identity.name,
      email: identity.email,
      avatar: identity.pictureUrl,
    };
  },
});

/**
 * Récupère un utilisateur par son Clerk ID
 */
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
  },
});

/**
 * Liste les utilisateurs par rôle
 */
export const getUsersByRole = query({
  args: {
    role: v.union(v.literal("admin"), v.literal("instructor"), v.literal("learner")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { role, limit = 50 }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", role))
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(limit);
  },
});

/**
 * Vérifie si l'utilisateur actuel a un rôle spécifique
 */
export const hasRole = query({
  args: { role: v.union(v.literal("admin"), v.literal("instructor"), v.literal("learner")) },
  handler: async (ctx, { role }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return user?.role === role;
  },
});

/**
 * Récupère les statistiques utilisateurs (pour admin)
 */
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    // Vérifier que l'utilisateur est admin
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (currentUser?.role !== "admin") {
      throw new Error("Admin access required");
    }

    const users = await ctx.db.query("users").collect();

    return {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      byRole: {
        admin: users.filter(u => u.role === "admin").length,
        instructor: users.filter(u => u.role === "instructor").length,
        learner: users.filter(u => u.role === "learner").length,
      },
      recentSignups: users.filter(u =>
        Date.now() - u.createdAt < 7 * 24 * 60 * 60 * 1000 // 7 jours
      ).length,
    };
  },
});

// === MUTATIONS ===

/**
 * Crée ou met à jour un utilisateur lors de la première connexion Clerk
 */
export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    role: v.optional(v.union(v.literal("admin"), v.literal("instructor"), v.literal("learner"))),
    preferences: v.optional(v.object({
      language: v.string(),
      timezone: v.string(),
      emailNotifications: v.boolean(),
      aiTutorEnabled: v.boolean(),
      studyReminders: v.boolean(),
      difficultyPreference: v.union(v.literal("adaptive"), v.literal("easy"), v.literal("medium"), v.literal("hard")),
    })),
  },
  handler: async (ctx, { clerkId, role = "learner", preferences }) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existingUser) {
      // Mettre à jour la dernière connexion
      return await ctx.db.patch(existingUser._id, {
        lastLoginAt: Date.now(),
      });
    }

    // Créer un nouvel utilisateur
    const defaultPreferences = {
      language: "fr",
      timezone: "Europe/Paris",
      emailNotifications: true,
      aiTutorEnabled: true,
      studyReminders: true,
      difficultyPreference: "adaptive" as const,
      ...preferences,
    };

    return await ctx.db.insert("users", {
      clerkId,
      role,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      isActive: true,
      preferences: defaultPreferences,
    });
  },
});

/**
 * Met à jour les préférences utilisateur
 */
export const updateUserPreferences = mutation({
  args: {
    preferences: v.object({
      language: v.optional(v.string()),
      timezone: v.optional(v.string()),
      emailNotifications: v.optional(v.boolean()),
      aiTutorEnabled: v.optional(v.boolean()),
      studyReminders: v.optional(v.boolean()),
      difficultyPreference: v.optional(v.union(v.literal("adaptive"), v.literal("easy"), v.literal("medium"), v.literal("hard"))),
    }),
  },
  handler: async (ctx, { preferences }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    return await ctx.db.patch(user._id, {
      preferences: {
        ...user.preferences,
        ...preferences,
      },
    });
  },
});

/**
 * Met à jour le profil d'apprentissage (pour l'IA)
 */
export const updateLearningProfile = mutation({
  args: {
    learningProfile: v.object({
      learningStyle: v.union(v.literal("visual"), v.literal("auditory"), v.literal("kinesthetic"), v.literal("mixed")),
      preferredPace: v.union(v.literal("slow"), v.literal("normal"), v.literal("fast")),
      strengths: v.array(v.string()),
      improvementAreas: v.array(v.string()),
    }),
  },
  handler: async (ctx, { learningProfile }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    return await ctx.db.patch(user._id, {
      learningProfile,
    });
  },
});

/**
 * Change le rôle d'un utilisateur (admin seulement)
 */
export const updateUserRole = mutation({
  args: {
    targetClerkId: v.string(),
    newRole: v.union(v.literal("admin"), v.literal("instructor"), v.literal("learner")),
  },
  handler: async (ctx, { targetClerkId, newRole }) => {
    // Vérifier que l'utilisateur actuel est admin
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (currentUser?.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Trouver l'utilisateur cible
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", targetClerkId))
      .unique();

    if (!targetUser) throw new Error("Target user not found");

    return await ctx.db.patch(targetUser._id, {
      role: newRole,
    });
  },
});

/**
 * Désactive/Active un utilisateur (admin seulement)
 */
export const toggleUserStatus = mutation({
  args: {
    targetClerkId: v.string(),
  },
  handler: async (ctx, { targetClerkId }) => {
    // Vérifier que l'utilisateur actuel est admin
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (currentUser?.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Trouver l'utilisateur cible
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", targetClerkId))
      .unique();

    if (!targetUser) throw new Error("Target user not found");

    return await ctx.db.patch(targetUser._id, {
      isActive: !targetUser.isActive,
    });
  },
});

/**
 * Supprime les données utilisateur (GDPR - admin seulement)
 */
export const deleteUserData = mutation({
  args: {
    targetClerkId: v.string(),
  },
  handler: async (ctx, { targetClerkId }) => {
    // Vérifier que l'utilisateur actuel est admin
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (currentUser?.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Trouver l'utilisateur cible
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", targetClerkId))
      .unique();

    if (!targetUser) throw new Error("Target user not found");

    // TODO: Supprimer aussi les données liées (enrollments, submissions, etc.)
    // Pour l'instant, on ne fait que supprimer l'utilisateur
    return await ctx.db.delete(targetUser._id);
  },
});
