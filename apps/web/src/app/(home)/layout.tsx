import { type Metadata } from "next";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { OnboardingWrapper } from "~/components/onboarding/OnboardingWrapper";
import "~/styles/globals.css";

export const metadata: Metadata = {
  title: "LMS Platform",
  description: "Your Learning Management System",
};

export default function HomeLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <SignedOut>
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
          <header className="flex h-16 items-center justify-between px-6">
            <div className="text-xl font-bold text-purple-600">
              LMS Platform
            </div>
            <div className="flex items-center gap-4">
              <SignInButton mode="modal">
                <button className="text-gray-700 hover:text-gray-900 font-medium">
                  Se connecter
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="h-10 cursor-pointer rounded-full bg-purple-600 px-6 text-sm font-medium text-white hover:bg-purple-700 transition-colors">
                  S'inscrire
                </button>
              </SignUpButton>
            </div>
          </header>
          {children}
        </div>
      </SignedOut>

      <SignedIn>
        <OnboardingWrapper>
          <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm border-b">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  <div className="flex items-center space-x-8">
                    <div className="text-xl font-bold text-purple-600">
                      LMS Platform
                    </div>
                    <nav className="hidden md:flex space-x-6">
                      <a href="/dashboard" className="text-gray-700 hover:text-purple-600 font-medium">
                        Dashboard
                      </a>
                      <a href="/courses" className="text-gray-700 hover:text-purple-600 font-medium">
                        Mes Cours
                      </a>
                      <a href="/catalog" className="text-gray-700 hover:text-purple-600 font-medium">
                        Catalogue
                      </a>
                    </nav>
                  </div>
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "h-10 w-10"
                      }
                    }}
                  />
                </div>
              </div>
            </nav>
            {children}
          </div>
        </OnboardingWrapper>
      </SignedIn>
    </>
  );
}