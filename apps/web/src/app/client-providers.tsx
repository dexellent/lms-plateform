"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { env } from "~/env";
import { TRPCReactProvider } from "~/trpc/react";

interface ClientProvidersProps {
  children: React.ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}