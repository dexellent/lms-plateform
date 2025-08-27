"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "~/../convex/_generated/api";

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
  { name: 'Mes Cours', href: '/courses', icon: '📚' },
  { name: 'Catalogue', href: '/catalog', icon: '🔍' },
  { name: 'Profil', href: '/profile', icon: '👤' },
];

const adminNavigation = [
  { name: 'Admin', href: '/admin', icon: '⚙️' },
  { name: 'Utilisateurs', href: '/admin/users', icon: '👥' },
  { name: 'Cours', href: '/admin/courses', icon: '📖' },
];

const instructorNavigation = [
  { name: 'Mes Cours', href: '/instructor/courses', icon: '🎓' },
  { name: 'Créer un cours', href: '/instructor/create', icon: '➕' },
  { name: 'Étudiants', href: '/instructor/students', icon: '👨‍🎓' },
];

export default function DashboardLayout({
                                          children,
                                        }: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const user = useQuery(api.user.getCurrentUser);

  const getNavigationItems = () => {
    let items = [...navigation];

    if (user?.role === 'admin') {
      items = [...items, ...adminNavigation];
    } else if (user?.role === 'instructor') {
      items = [...items, ...instructorNavigation];
    }

    return items;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo et navigation principale */}
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-bold text-purple-600">
                LMS Platform
              </Link>

              {/* Navigation desktop */}
              <nav className="hidden md:flex space-x-6">
                {getNavigationItems().map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-purple-100 text-purple-700'
                          : 'text-gray-700 hover:text-purple-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{item.icon}</span>
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-3.5-3.5a1.414 1.414 0 010-2L19 8l-3-3-8 8 3 3 8-8a1.414 1.414 0 012 0L21 15h-6z" />
                </svg>
              </button>

              {/* User info */}
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.name}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {user?.role === 'learner' ? 'Apprenant' :
                      user?.role === 'instructor' ? 'Instructeur' : 'Administrateur'}
                  </div>
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
          </div>
        </div>

        {/* Navigation mobile */}
        <div className="md:hidden border-t border-gray-200">
          <div className="px-4 py-2">
            <div className="flex space-x-1 overflow-x-auto">
              {getNavigationItems().map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                      isActive
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-700 hover:text-purple-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Contenu principal */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer (optionnel) */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              © 2024 LMS Platform. Tous droits réservés.
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <Link href="/help" className="hover:text-gray-700">
                Aide
              </Link>
              <Link href="/privacy" className="hover:text-gray-700">
                Confidentialité
              </Link>
              <Link href="/terms" className="hover:text-gray-700">
                Conditions
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}