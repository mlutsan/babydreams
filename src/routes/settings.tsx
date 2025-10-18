import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { getMetadata } from "~/server/auth";
import { sheetUrlAtom, googleTokenAtom, getValidAccessToken } from "~/lib/atoms";
import { useGoogleAuth } from "~/hooks/useGoogleAuth";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();

  // Google auth hook
  const { authState, user, requestSheetsAccess, logout } = useGoogleAuth();

  // Jotai atoms for persistent state
  const [sheetUrl, setSheetUrl] = useAtom(sheetUrlAtom);
  const tokenData = useAtomValue(googleTokenAtom);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSaveAndTest = async () => {
    if (!sheetUrl) {
      setErrorMessage("Please enter a Google Sheets URL");
      return;
    }

    setIsConnecting(true);
    setErrorMessage(null);

    try {
      const accessToken = getValidAccessToken(tokenData);

      // If no token, request authorization automatically
      if (!accessToken) {
        if (authState === "signed-out") {
          throw new Error("Please sign in with Google first");
        }

        // Token missing or expired - request it again
        console.log("Token missing/expired, requesting Sheets access...");
        requestSheetsAccess();
        throw new Error("Requesting authorization... Please approve the consent screen.");
      }

      // Fetch sheet metadata using server function
      const result = await getMetadata({ data: { sheetUrl, accessToken } });

      // Display metadata in toast
      const sheetsInfo = result.sheets
        .map((sheet) => sheet.title)
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
        {user && (
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Signed in with Google</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {user.picture && (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={logout}
                className="w-full"
              >
                Sign Out
              </Button>
            </CardContent>
          </Card>
        )}

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
                {authState === "signed-out" ? (
                  <p className="text-sm text-muted-foreground">
                    Please sign in with Google to continue
                  </p>
                ) : (
                  <Button
                    onClick={handleSaveAndTest}
                    disabled={!sheetUrl || isConnecting}
                  >
                    {isConnecting ? "Validating..." : "Save & Test Connection"}
                  </Button>
                )}

                {authState === "error" && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Authentication error. Please refresh the page.
                  </p>
                )}
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
