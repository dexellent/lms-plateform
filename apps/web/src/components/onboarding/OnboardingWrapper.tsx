"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "~/../convex/_generated/api";
import { useEffect, useState } from "react";
import { OnboardingFlow } from "./OnboardingFlow";

export function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();

  // Get or create user in Convex
  const convexUser = useQuery(api.user.getCurrentUser);
  const upsertUser = useMutation(api.user.upsertUser);

  useEffect(() => {
    if (isLoaded && user && !convexUser) {
      // User exists in Clerk but not in Convex - create them
      upsertUser({
        clerkId: user.id,
        role: "learner", // default role
      }).then(() => {
        setShowOnboarding(true);
      });
    } else if (convexUser && !convexUser.learningProfile) {
      // User exists but hasn't completed onboarding
      setShowOnboarding(true);
    } else if (convexUser && convexUser.learningProfile) {
      // User is fully set up, redirect to dashboard
      router.push('/dashboard');
    }
  }, [isLoaded, user, convexUser, upsertUser, router]);

  // Show loading while checking user status
  if (!isLoaded || (user && convexUser === undefined)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show onboarding if needed
  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={() => {
          setShowOnboarding(false);
          router.push('/dashboard');
        }}
      />
    );
  }

  return <>{children}</>;
}
