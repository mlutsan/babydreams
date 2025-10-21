/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "../styles.css?url";
import { Toaster } from "~/components/ui/sonner";
import { SettingsIcon } from "lucide-react";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Family Finance: Expense Tracker",
      },
      {
        name: "description",
        content: "A lightweight expense tracking app for families with Google Sheets integration",
      },
      {
        name: "theme-color",
        content: "#ffffff",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
      { rel: "icon", href: "/favicon.ico" },
    ],
    scripts: [{
      src: "https://accounts.google.com/gsi/client",
      async: true
    }]
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode; }) {

  return (
    <html>
      <head>
        <HeadContent />
      </head>

      <body>
        <div className="flex flex-col h-screen bg-background">
          {/* Top Navbar */}
          <header className="bg-muted border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">Family Finance</h1>

            </div>
            <div className="flex items-center gap-2">
              <Link to="/settings" className="p-2 hover:bg-muted/80 rounded-full transition-colors">
                <SettingsIcon />
              </Link>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>

          {/* Bottom Tab Navigation */}
          <nav className="bg-card border-t border-border px-4 py-2 shadow-lg">
            <div className="flex justify-around items-center max-w-lg mx-auto">
              <Link
                to="/"
                className="flex flex-col items-center py-2 px-4 rounded-lg transition-colors text-muted-foreground"
                activeProps={{
                  className: "bg-primary/10 text-primary",
                }}
                activeOptions={{ exact: true }}
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs font-medium">Add Expense</span>
              </Link>
              <Link
                to="/history"
                className="flex flex-col items-center py-2 px-4 rounded-lg transition-colors text-muted-foreground"
                activeProps={{
                  className: "bg-primary/10 text-primary",
                }}
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium">History</span>
              </Link>
            </div>
          </nav>
        </div>
        <Toaster />
        <TanStackRouterDevtools position="bottom-right" />
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </body>

    </html>
  );
}
