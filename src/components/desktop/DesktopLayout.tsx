import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";
import { Toaster } from "~/components/ui/sonner";

interface DesktopLayoutProps {
  children: ReactNode;
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
  return (
    <div data-ui-mode="desktop" className="flex flex-col h-screen bg-background">
      {/* Top Navbar */}
      <header className="bg-muted border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">
            Family Finance
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="p-2 hover:bg-muted/80 rounded-full transition-colors"
          >
            <SettingsIcon />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>

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
            <svg
              className="w-6 h-6 mb-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
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
            <svg
              className="w-6 h-6 mb-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs font-medium">History</span>
          </Link>
        </div>
      </nav>
      <Toaster />
    </div>
  );
}
