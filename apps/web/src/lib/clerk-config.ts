// Thème personnalisé pour Clerk
export const clerkAppearance = {
  baseTheme: undefined,
  variables: {
    colorPrimary: "#7c3aed", // purple-600
    colorBackground: "#ffffff",
    colorText: "#1f2937", // gray-800
    colorTextSecondary: "#6b7280", // gray-500
    colorInputBackground: "#ffffff",
    colorInputText: "#1f2937",
    borderRadius: "0.5rem",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  elements: {
    rootBox: "font-sans",
    card: "shadow-xl border-0 rounded-lg",
    headerTitle: "text-2xl font-bold text-gray-900",
    headerSubtitle: "text-gray-600",
    socialButtonsBlockButton:
      "bg-white border border-gray-300 hover:bg-gray-50 text-gray-700",
    socialButtonsBlockButtonText: "font-medium",
    formButtonPrimary:
      "bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md",
    footerActionText: "text-gray-600",
    footerActionLink: "text-purple-600 hover:text-purple-700 font-medium",
    identityPreviewText: "text-gray-700",
    identityPreviewEditButton: "text-purple-600 hover:text-purple-700",
  },
};

// Messages personnalisés en français
export const clerkLocalization = {
  signIn: {
    start: {
      title: "Connectez-vous à votre compte",
      subtitle: "pour continuer vers {{applicationName}}",
    },
  },
  signUp: {
    start: {
      title: "Créez votre compte",
      subtitle: "pour commencer avec {{applicationName}}",
    },
  },
};
