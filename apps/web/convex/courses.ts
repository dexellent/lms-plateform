import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// === QUERIES ===

/**
 * Récupère tous les cours publiés avec pagination
 */
export const getPublishedCourses = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { limit = 20, cursor, category }) => {
    let query = ctx.db
      .query("courses")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc");

    if (category) {
      query = query.filter((q) => q.eq(q.field("category"), category));
    }

    const courses = await query.take(limit);

    // Enrichir avec les informations de l'instructeur
    const enrichedCourses = await Promise.all(
      courses.map(async (course) => {
        const instructor = await ctx.db.get(course.instructorId);
        return {
          ...course,
          instructor: instructor ? {
            id: instructor._id,
            clerkId: instructor.clerkId,
            role: instructor.role,
          } : null,
        };
      })
    );

    return enrichedCourses;
  },
});

/**
 * Récupère un cours par son ID avec ses modules
 */
export const getCourseWithModules = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const course = await ctx.db.get(courseId);
    if (!course) return null;

    // Vérifier les permissions (publié ou propriétaire/admin)
    const identity = await ctx.auth.getUserIdentity();
    const currentUser = identity ? await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique() : null;

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

    // Récupérer l'instructeur
    const instructor = await ctx.db.get(course.instructorId);

    return {
      ...course,
      modules,
      instructor: instructor ? {
        id: instructor._id,
        clerkId: instructor.clerkId,
        role: instructor.role,
      } : null,
    };
  },
});

/**
 * Récupère les cours d'un instructeur
 */
export const getInstructorCourses = query({
  args: {
    instructorClerkId: v.optional(v.string()),
    includeStats: v.optional(v.boolean()),
  },
  handler: async (ctx, { instructorClerkId, includeStats = false }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    let targetClerkId = instructorClerkId;

    // Si pas de clerkId spécifié, utiliser l'utilisateur actuel
    if (!targetClerkId) {
      targetClerkId = identity.subject;
    }

    // Récupérer l'instructeur
    const instructor = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", targetClerkId))
      .unique();

    if (!instructor) throw new Error("Instructor not found");

    // Vérifier les permissions
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const canAccess = currentUser?.role === "admin" ||
      currentUser?._id === instructor._id;

    if (!canAccess) {
      throw new Error("Access denied");
    }

    // Récupérer les cours
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_instructor", (q) => q.eq("instructorId", instructor._id))
      .order("desc")
      .collect();

    if (!includeStats) {
      return courses;
    }

    // Ajouter les statistiques
    const coursesWithStats = await Promise.all(
      courses.map(async (course) => {
        const enrollments = await ctx.db
          .query("enrollments")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect();

        const activeEnrollments = enrollments.filter(e => e.status === "active");
        const completedEnrollments = enrollments.filter(e => e.status === "completed");

        return {
          ...course,
          stats: {
            totalEnrollments: enrollments.length,
            activeEnrollments: activeEnrollments.length,
            completedEnrollments: completedEnrollments.length,
            averageProgress: activeEnrollments.length > 0
              ? activeEnrollments.reduce((acc, e) => acc + e.progressPercentage, 0) / activeEnrollments.length
              : 0,
          },
        };
      })
    );

    return coursesWithStats;
  },
});

/**
 * Recherche de cours
 */
export const searchCourses = query({
  args: {
    searchTerm: v.string(),
    category: v.optional(v.string()),
    level: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { searchTerm, category, level, limit = 20 }) => {
    let courses = await ctx.db
      .query("courses")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();

    // Filtrer par terme de recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      courses = courses.filter(course =>
        course.title.toLowerCase().includes(term) ||
        course.description.toLowerCase().includes(term) ||
        course.tags.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Filtrer par catégorie
    if (category) {
      courses = courses.filter(course => course.category === category);
    }

    // Filtrer par niveau
    if (level) {
      courses = courses.filter(course => course.level === level);
    }

    // Limiter les résultats
    courses = courses.slice(0, limit);

    // Enrichir avec les informations de l'instructeur
    const enrichedCourses = await Promise.all(
      courses.map(async (course) => {
        const instructor = await ctx.db.get(course.instructorId);
        return {
          ...course,
          instructor: instructor ? {
            id: instructor._id,
            clerkId: instructor.clerkId,
            role: instructor.role,
          } : null,
        };
      })
    );

    return enrichedCourses;
  },
});

/**
 * Récupère les catégories de cours disponibles
 */
export const getCourseCategories = query({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();

    const categories = [...new Set(courses.map(course => course.category))];

    // Compter les cours par catégorie
    const categoriesWithCount = categories.map(category => ({
      name: category,
      count: courses.filter(course => course.category === category).length,
    }));

    return categoriesWithCount.sort((a, b) => b.count - a.count);
  },
});

// === MUTATIONS ===

/**
 * Crée un nouveau cours
 */
export const createCourse = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    level: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
    estimatedDuration: v.number(),
    tags: v.array(v.string()),
    learningObjectives: v.array(v.string()),
    prerequisites: v.array(v.string()),
    thumbnail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");
    if (user.role !== "instructor" && user.role !== "admin") {
      throw new Error("Only instructors and admins can create courses");
    }

    const courseId = await ctx.db.insert("courses", {
      ...args,
      instructorId: user._id,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enrollmentCount: 0,
    });

    return courseId;
  },
});

/**
 * Met à jour un cours
 */
export const updateCourse = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    level: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
    estimatedDuration: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    learningObjectives: v.optional(v.array(v.string())),
    prerequisites: v.optional(v.array(v.string())),
    thumbnail: v.optional(v.string()),
  },
  handler: async (ctx, { courseId, ...updates }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found");

    // Vérifier les permissions
    const canEdit = user.role === "admin" || course.instructorId === user._id;
    if (!canEdit) {
      throw new Error("Permission denied");
    }

    return await ctx.db.patch(courseId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Publie ou dépublie un cours
 */
export const toggleCourseStatus = mutation({
  args: {
    courseId: v.id("courses"),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
  },
  handler: async (ctx, { courseId, status }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found");

    // Vérifier les permissions
    const canEdit = user.role === "admin" || course.instructorId === user._id;
    if (!canEdit) {
      throw new Error("Permission denied");
    }

    const updateData: any = {
      status,
      updatedAt: Date.now(),
    };

    // Ajouter publishedAt si on publie
    if (status === "published" && course.status !== "published") {
      updateData.publishedAt = Date.now();
    }

    return await ctx.db.patch(courseId, updateData);
  },
});

/**
 * Supprime un cours
 */
export const deleteCourse = mutation({
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

    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found");

    // Vérifier les permissions
    const canDelete = user.role === "admin" || course.instructorId === user._id;
    if (!canDelete) {
      throw new Error("Permission denied");
    }

    // Vérifier qu'il n'y a pas d'inscriptions actives
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    if (enrollments.length > 0) {
      throw new Error("Cannot delete course with active enrollments. Archive it instead.");
    }

    // Supprimer les modules associés
    const modules = await ctx.db
      .query("modules")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();

    for (const module of modules) {
      await ctx.db.delete(module._id);
    }

    // Supprimer le cours
    return await ctx.db.delete(courseId);
  },
});

/**
 * Duplique un cours
 */
export const duplicateCourse = mutation({
  args: {
    courseId: v.id("courses"),
    newTitle: v.optional(v.string()),
  },
  handler: async (ctx, { courseId, newTitle }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");
    if (user.role !== "instructor" && user.role !== "admin") {
      throw new Error("Only instructors and admins can duplicate courses");
    }

    const originalCourse = await ctx.db.get(courseId);
    if (!originalCourse) throw new Error("Course not found");

    // Créer le nouveau cours
    const { _id, _creationTime, status, publishedAt, enrollmentCount, ...courseData } = originalCourse;

    const newCourseId = await ctx.db.insert("courses", {
      ...courseData,
      title: newTitle || `${originalCourse.title} (Copie)`,
      instructorId: user._id,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enrollmentCount: 0,
    });

    // Dupliquer les modules
    const modules = await ctx.db
      .query("modules")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();

    for (const module of modules) {
      const { _id, _creationTime, courseId: _, ...moduleData } = module;
      await ctx.db.insert("modules", {
        ...moduleData,
        courseId: newCourseId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return newCourseId;
  },
});
