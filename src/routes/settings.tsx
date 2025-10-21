import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { getMetadata } from "~/server/auth";
import { sheetUrlAtom, userNameAtom, generateRandomName } from "~/lib/atoms";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();

  // Jotai atoms for persistent state
  const [sheetUrl, setSheetUrl] = useAtom(sheetUrlAtom);
  const [userName, setUserName] = useAtom(userNameAtom);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Generate new random name
  const handleGenerateNewName = () => {
    setUserName(generateRandomName());
  };

  const handleSaveAndTest = async () => {
    if (!sheetUrl) {
      setErrorMessage("Please enter a Google Sheets URL");
      return;
    }

    setIsConnecting(true);
    setErrorMessage(null);

    try {

      // Fetch sheet metadata using server function
      const result = await getMetadata({ data: { sheetUrl } });

      // Display metadata in toast
      const sheetsInfo = result.sheets
        .map((sheet: { title: string; }) => sheet.title)
        .join(", ");

      toast.success("Sheet validated successfully!", {
        description: `${result.title} (${result.sheetCount} sheets: ${sheetsInfo})`,
        duration: 5000,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to validate sheet");
      console.error("Sheet validation failed:", error);
    } finally {
      setIsConnecting(false);
    }
  };

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

      <div className="space-y-6 max-w-2xl">

        <Card>
          <CardHeader>
            <CardTitle>Your Name</CardTitle>
            <CardDescription>
              This name will be used to identify your expenses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Display Name</Label>
              <div className="flex gap-2">
                <Input
                  id="userName"
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleGenerateNewName}
                  type="button"
                >
                  🎲 Random
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                A random name has been generated for you, or you can enter your own
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Google Sheets Integration</CardTitle>
            <CardDescription>
              Connect to your Google Sheet to save expenses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sheetUrl">Google Sheet URL</Label>
              <Input
                id="sheetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Paste the URL of your Google Sheet
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-4 flex-wrap">

                <Button
                  onClick={handleSaveAndTest}
                  disabled={!sheetUrl || isConnecting}
                >
                  {isConnecting ? "Validating..." : "Save & Test Connection"}
                </Button>

              </div>

              {errorMessage && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Error: {errorMessage}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
