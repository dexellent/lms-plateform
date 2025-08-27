import { SignUp } from '@clerk/nextjs';
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Rejoignez LMS Platform
          </h2>
          <p className="text-gray-600">
            Créez votre compte et commencez à apprendre
          </p>
        </div>

        <SignUp
          routing="path"
          path="/sign-up"
          fallbackRedirectUrl="/dashboard"
          signInFallbackRedirectUrl="/dashboard"
          signInUrl="/sign-in"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'w-full shadow-2xl',
            },
          }}
        />

        <div className="text-center text-sm text-gray-500 mt-6">
          <p>
            Vous avez déjà un compte ?{' '}
            <Link href="/sign-in" className="text-purple-600 hover:text-purple-700 font-medium">
              Connectez-vous
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}