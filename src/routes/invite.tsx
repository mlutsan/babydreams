import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { sheetUrlAtom, userNameAtom } from "~/lib/atoms";
import { UserPlus } from "lucide-react";

export const Route = createFileRoute("/invite")({
  component: InvitePage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      sheet: (search.sheet as string) || "",
      name: (search.name as string) || "",
    };
  },
});

function InvitePage() {
  const navigate = useNavigate();
  const { sheet, name } = Route.useSearch();

  const [, setSheetUrl] = useAtom(sheetUrlAtom);
  const [userName, setUserName] = useAtom(userNameAtom);
  const [localName, setLocalName] = useState(userName);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isMigration, setIsMigration] = useState(false);

  useEffect(() => {
    if (!sheet) {
      toast.error("Invalid invite link", {
        description: "No sheet URL found in the invite link",
      });
      navigate({ to: "/settings" });
      return;
    }

    // Decode and save the sheet URL
    try {
      const decodedSheet = decodeURIComponent(sheet);
      setSheetUrl(decodedSheet);

      // If name parameter is present, this is a personal migration link
      if (name) {
        const decodedName = decodeURIComponent(name);
        setLocalName(decodedName);
        setIsMigration(true);
        toast.success("Settings ready to migrate!", {
          description: "Click 'Complete Setup' to finish migration",
        });
      } else {
        toast.success("Sheet configured!", {
          description: "Now enter your name to complete setup",
        });
      }
    } catch {
      toast.error("Invalid invite link", {
        description: "Failed to decode sheet URL",
      });
      navigate({ to: "/settings" });
    }
  }, [sheet, name, setSheetUrl, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!localName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setUserName(localName);
    setIsSetupComplete(true);

    toast.success("Welcome to the family!", {
      description: "You're all set up and ready to track expenses",
      duration: 3000,
    });

    // Navigate to home after a short delay
    setTimeout(() => {
      navigate({ to: "/" });
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <UserPlus className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {isMigration ? "Migrate Your Settings" : "Welcome to Family Finance!"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isMigration
              ? "Complete the migration to use your settings in the PWA"
              : "You've been invited to join a shared expense tracker"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isMigration ? "Confirm Your Settings" : "Complete Your Setup"}</CardTitle>
            <CardDescription>
              {isMigration
                ? "Verify your name and complete the migration"
                : "Enter your name to start tracking expenses with your family"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  disabled={isSetupComplete}
                  autoFocus={!isMigration}
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">
                  This name will be used to identify your expenses
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSetupComplete || !localName.trim()}
              >
                {isSetupComplete ? "Redirecting..." : isMigration ? "Complete Migration" : "Complete Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-4">
          <p className="text-sm text-muted-foreground">
            {isMigration
              ? "Your Google Sheet and name will be saved in the PWA"
              : "The Google Sheet has been configured automatically"}
          </p>
        </div>
      </div>
    </div>
  );
}
