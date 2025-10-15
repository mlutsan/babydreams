import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="p-4">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/" })}
          className="mr-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Button>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
      </div>
      <p className="text-muted-foreground">Settings form will go here (Phase 2)</p>
    </div>
  );
}
