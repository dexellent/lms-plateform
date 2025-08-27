"use client";

import { useQuery } from "convex/react";
import { api } from "~/../convex/_generated/api";
import { useUser } from "@clerk/nextjs";

export default function DashboardPage() {
  const { user } = useUser();
  const convexUser = useQuery(api.user.getCurrentUser);
  const userEnrollments = useQuery(api.enrollments.getMyEnrollments, "skip");
  const userStats = useQuery(api.enrollments.getEnrollmentStats, "skip");

  if (!convexUser) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Bonjour, {user?.firstName || 'Utilisateur'} ! 👋
                </h1>
                <p className="text-gray-600 mt-1">
                  Prêt à continuer votre apprentissage ?
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Votre rôle</div>
                  <div className="font-medium capitalize text-purple-600">
                    {convexUser.role === 'learner' ? 'Apprenant' :
                      convexUser.role === 'instructor' ? 'Instructeur' : 'Administrateur'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Stats Cards */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {userEnrollments?.filter(e => e.status === 'active').length || 0}
                  </div>
                  <div className="text-gray-600">Cours actifs</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {userEnrollments?.filter(e => e.status === 'completed').length || 0}
                  </div>
                  <div className="text-gray-600">Cours terminés</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {userStats?.averageProgress ? Math.round(userStats.averageProgress) : 0}%
                  </div>
                  <div className="text-gray-600">Progrès moyen</div>
                </div>
              </div>
            </div>
          </div>

          {/* Cours en cours */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Mes cours en cours</h2>
              </div>
              <div className="p-6">
                {userEnrollments?.filter(e => e.status === 'active').length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun cours en cours</h3>
                    <p className="text-gray-600 mb-4">Commencez votre parcours d'apprentissage dès maintenant !</p>
                    <button className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 transition-colors">
                      Parcourir les cours
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userEnrollments?.filter(e => e.status === 'active').map((enrollment) => (
                      <div key={enrollment._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-medium text-gray-900">
                            {enrollment.course?.title}
                          </h3>
                          <span className="text-sm text-gray-500">
                            {enrollment.progressPercentage}% terminé
                          </span>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${enrollment.progressPercentage}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>Dernière activité: {new Date(enrollment.lastAccessedAt || enrollment.enrolledAt).toLocaleDateString('fr-FR')}</span>
                          <button className="text-purple-600 hover:text-purple-800 font-medium">
                            Continuer →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Recommandations */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recommandé pour vous</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {convexUser.learningProfile && (
                    <div className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-medium text-gray-900">Basé sur votre profil</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Style d'apprentissage: <span className="capitalize">{convexUser.learningProfile.learningStyle}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Rythme: <span className="capitalize">{convexUser.learningProfile.preferredPace}</span>
                      </p>
                    </div>
                  )}

                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">🎯 Suggestion du jour</h4>
                    <p className="text-sm text-gray-600">
                      Basé sur vos préférences d'apprentissage, nous recommandons de commencer par des cours {convexUser.preferences?.difficultyPreference}.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Réglages rapides */}
            <div className="bg-white rounded-lg shadow mt-6">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Réglages rapides</h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">IA Tuteur</span>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${convexUser.preferences?.aiTutorEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${convexUser.preferences?.aiTutorEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Notifications</span>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${convexUser.preferences?.emailNotifications ? 'bg-purple-600' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${convexUser.preferences?.emailNotifications ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Rappels</span>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${convexUser.preferences?.studyReminders ? 'bg-purple-600' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${convexUser.preferences?.studyReminders ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}