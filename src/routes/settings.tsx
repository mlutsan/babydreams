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
import { Link2 } from "lucide-react";

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
  const [restoreLink, setRestoreLink] = useState("");

  // Generate new random name
  const handleGenerateNewName = () => {
    setUserName(generateRandomName());
  };

  // Generate invite link
  const handleGenerateInviteLink = () => {
    const baseUrl = window.location.origin;
    const encodedSheet = encodeURIComponent(sheetUrl);
    const inviteUrl = `${baseUrl}/invite?sheet=${encodedSheet}`;

    // Copy to clipboard
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied!", {
      description: "Share this link with your family members",
      duration: 3000,
    });
  };

  // Generate personal setup link (includes name for migration)
  const handleGenerateSetupLink = () => {
    const baseUrl = window.location.origin;
    const encodedSheet = encodeURIComponent(sheetUrl);
    const encodedName = encodeURIComponent(userName);
    const setupUrl = `${baseUrl}/invite?sheet=${encodedSheet}&name=${encodedName}`;

    // Copy to clipboard
    navigator.clipboard.writeText(setupUrl);
    toast.success("Setup link copied!", {
      description: "Use this link to set up the app after installing to home screen",
      duration: 4000,
    });
  };

  // Restore from setup link
  const handleRestoreFromLink = () => {
    if (!restoreLink.trim()) {
      toast.error("Please paste a setup link");
      return;
    }

    try {
      const url = new URL(restoreLink);
      const sheet = url.searchParams.get("sheet");
      const name = url.searchParams.get("name");

      if (!sheet) {
        toast.error("Invalid link", {
          description: "No sheet URL found in the link",
        });
        return;
      }

      // Navigate to invite page with the parameters
      navigate({ to: "/invite", search: { sheet, name: name || "" } });
    } catch {
      toast.error("Invalid URL", {
        description: "Please paste a valid setup link",
      });
    }
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

        {!sheetUrl && (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle>Restore from Setup Link</CardTitle>
              <CardDescription>
                Have a setup link? Paste it here to restore your settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="restoreLink">Setup Link</Label>
                <div className="flex gap-2">
                  <Input
                    id="restoreLink"
                    placeholder="https://..."
                    value={restoreLink}
                    onChange={(e) => setRestoreLink(e.target.value)}
                    className="flex-1 text-base"
                  />
                  <Button
                    onClick={handleRestoreFromLink}
                    disabled={!restoreLink.trim()}
                  >
                    Restore
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  This is useful when migrating from Safari to PWA
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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

        {sheetUrl && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>PWA Migration</CardTitle>
                <CardDescription>
                  Migrate your settings when installing to home screen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    📱 Installing as PWA?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    iOS PWAs have separate storage from Safari. Follow these steps to migrate:
                  </p>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Click &quot;Share Setup Link&quot; and send to yourself (Messages, Notes, etc.)</li>
                    <li>Add this app to your home screen</li>
                    <li>Alternative: Use &quot;Copy Link&quot; and paste in Settings → Restore from Setup Link</li>
                  </ol>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleGenerateSetupLink}
                    variant="outline"
                    className="flex-1 sm:flex-none"
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invite Family Members</CardTitle>
                <CardDescription>
                  Share your expense tracker with family members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate an invite link that includes your Google Sheet configuration.
                  When someone opens this link, they&apos;ll be prompted to enter their name
                  and will be ready to track expenses in the same sheet.
                </p>
                <Button
                  onClick={handleGenerateInviteLink}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Generate & Copy Invite Link
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
