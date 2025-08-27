import { SignIn } from '@clerk/nextjs';
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Bienvenue sur LMS Platform
          </h2>
          <p className="text-gray-600">
            Connectez-vous pour accéder à vos cours
          </p>
        </div>

        <SignIn
          routing="path"
          path="/sign-in"
          fallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          signUpUrl="/sign-up"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'w-full shadow-2xl',
            },
          }}
        />

        <div className="text-center text-sm text-gray-500 mt-6">
          <p>
            Vous n'avez pas de compte ?{' '}
            <Link href="/sign-up" className="text-purple-600 hover:text-purple-700 font-medium">
              Créez-en un gratuitement
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}