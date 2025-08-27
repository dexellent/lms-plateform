"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "~/../convex/_generated/api";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState({
    language: "fr",
    timezone: "Europe/Paris",
    emailNotifications: true,
    aiTutorEnabled: true,
    studyReminders: true,
    difficultyPreference: "adaptive" as const,
  });

  const [learningProfile, setLearningProfile] = useState({
    learningStyle: "visual" as const,
    preferredPace: "normal" as const,
    strengths: [] as string[],
    improvementAreas: [] as string[],
  });

  const updatePreferences = useMutation(api.user.updateUserPreferences);
  const updateLearningProfile = useMutation(api.user.updateLearningProfile);

  const handleCompleteOnboarding = async () => {
    try {
      await updatePreferences({ preferences });
      await updateLearningProfile({ learningProfile });
      onComplete();
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Welcome to the LMS!</h1>
            <span className="text-sm text-gray-500">Step {step} of 3</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-4">Let's set up your preferences</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Language
              </label>
              <select
                value={preferences.language}
                onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timezone
              </label>
              <select
                value={preferences.timezone}
                onChange={(e) => setPreferences(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty Preference
              </label>
              <select
                value={preferences.difficultyPreference}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  difficultyPreference: e.target.value as typeof preferences.difficultyPreference
                }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="adaptive">Adaptive (Recommended)</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.emailNotifications}
                  onChange={(e) => setPreferences(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Email notifications</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.aiTutorEnabled}
                  onChange={(e) => setPreferences(prev => ({ ...prev, aiTutorEnabled: e.target.checked }))}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">AI Tutor assistance</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.studyReminders}
                  onChange={(e) => setPreferences(prev => ({ ...prev, studyReminders: e.target.checked }))}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Study reminders</span>
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-4">Tell us about your learning style</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How do you learn best?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "visual", label: "Visual (Images, diagrams)" },
                  { value: "auditory", label: "Auditory (Listening)" },
                  { value: "kinesthetic", label: "Hands-on practice" },
                  { value: "mixed", label: "Mixed approach" },
                ].map((style) => (
                  <label key={style.value} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="learningStyle"
                      value={style.value}
                      checked={learningProfile.learningStyle === style.value}
                      onChange={(e) => setLearningProfile(prev => ({
                        ...prev,
                        learningStyle: e.target.value as typeof prev.learningStyle
                      }))}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="ml-2 text-sm">{style.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred learning pace
              </label>
              <div className="flex space-x-3">
                {[
                  { value: "slow", label: "Take my time" },
                  { value: "normal", label: "Normal pace" },
                  { value: "fast", label: "Quick learner" },
                ].map((pace) => (
                  <label key={pace.value} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 flex-1">
                    <input
                      type="radio"
                      name="preferredPace"
                      value={pace.value}
                      checked={learningProfile.preferredPace === pace.value}
                      onChange={(e) => setLearningProfile(prev => ({
                        ...prev,
                        preferredPace: e.target.value as typeof prev.preferredPace
                      }))}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="ml-2 text-sm text-center flex-1">{pace.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-4">What are your strengths and goals?</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your strengths (select all that apply)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Problem solving", "Critical thinking", "Communication", "Creativity",
                  "Technical skills", "Leadership", "Organization", "Research"
                ].map((strength) => (
                  <label key={strength} className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={learningProfile.strengths.includes(strength)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setLearningProfile(prev => ({
                            ...prev,
                            strengths: [...prev.strengths, strength]
                          }));
                        } else {
                          setLearningProfile(prev => ({
                            ...prev,
                            strengths: prev.strengths.filter(s => s !== strength)
                          }));
                        }
                      }}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm">{strength}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Areas you'd like to improve
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Time management", "Public speaking", "Writing", "Math skills",
                  "Technology", "Language", "Memory", "Focus"
                ].map((area) => (
                  <label key={area} className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={learningProfile.improvementAreas.includes(area)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setLearningProfile(prev => ({
                            ...prev,
                            improvementAreas: [...prev.improvementAreas, area]
                          }));
                        } else {
                          setLearningProfile(prev => ({
                            ...prev,
                            improvementAreas: prev.improvementAreas.filter(a => a !== area)
                          }));
                        }
                      }}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm">{area}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-8">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
          )}

          <div className="flex-1" />

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCompleteOnboarding}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Complete Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
