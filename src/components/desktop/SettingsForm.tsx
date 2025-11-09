import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { getSheetMetadata } from "~/server/proxy";
import { Link2 } from "lucide-react";

interface SettingsFormProps {
  sheetUrl: string;
  babyName: string;
  babyBirthdate: string;
  setSheetUrl: (url: string) => void;
  setBabyName: (name: string) => void;
  setBabyBirthdate: (date: string) => void;
}

export function SettingsForm({
  sheetUrl,
  babyName,
  babyBirthdate,
  setSheetUrl,
  setBabyName,
  setBabyBirthdate,
}: SettingsFormProps) {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [restoreLink, setRestoreLink] = useState("");

  const handleGenerateSetupLink = () => {
    const baseUrl = window.location.origin;
    const encodedSheet = encodeURIComponent(sheetUrl);
    const setupUrl = `${baseUrl}/invite?sheet=${encodedSheet}`;

    navigator.clipboard.writeText(setupUrl);
    toast.success("Setup link copied!", {
      description:
        "Use this link to set up the app after installing to home screen",
      duration: 4000,
    });
  };

  const handleRestoreFromLink = () => {
    if (!restoreLink.trim()) {
      toast.error("Please paste a setup link");
      return;
    }

    try {
      const url = new URL(restoreLink);
      const sheet = url.searchParams.get("sheet");

      if (!sheet) {
        toast.error("Invalid link", {
          description: "No sheet URL found in the link",
        });
        return;
      }

      navigate({ to: "/invite", search: { sheet } });
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
      const metadata = (await getSheetMetadata({ data: { sheetUrl } })) as {
        properties?: { title?: string };
        sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
      };

      // Transform metadata to match expected format
      const result = {
        title: metadata.properties?.title || "Unknown",
        sheetCount: metadata.sheets?.length || 0,
        sheets:
          metadata.sheets?.map((sheet: { properties?: { title?: string; sheetId?: number } }) => ({
            title: sheet.properties?.title || "Untitled",
            sheetId: sheet.properties?.sheetId || 0,
          })) || [],
      };

      const sheetsInfo = result.sheets
        .map((sheet: { title: string }) => sheet.title)
        .join(", ");

      // Check if required sheets exist
      const requiredSheets = ["Settings", "Sleep", "Eat"];
      const sheetTitles = result.sheets.map((s: { title: string }) => s.title);
      const missingSheets = requiredSheets.filter(
        (req) => !sheetTitles.includes(req)
      );

      if (missingSheets.length > 0) {
        setErrorMessage(
          `Missing required sheets: ${missingSheets.join(", ")}. Please create: Settings, Sleep, and Eat sheets.`
        );
        return;
      }

      toast.success("Sheet validated successfully!", {
        description: `${result.title} - All required sheets found (Settings, Sleep, Eat)`,
        duration: 5000,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to validate sheet"
      );
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
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
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
            <CardTitle>Baby Profile</CardTitle>
            <CardDescription>
              Information about your baby
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="babyName">Baby Name</Label>
              <Input
                id="babyName"
                placeholder="Enter baby's name"
                value={babyName}
                onChange={(e) => setBabyName(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Your baby's name will appear throughout the app
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="babyBirthdate">Birthdate</Label>
              <Input
                id="babyBirthdate"
                type="date"
                value={babyBirthdate}
                onChange={(e) => setBabyBirthdate(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Baby's date of birth (YYYY-MM-DD)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Google Sheets Integration</CardTitle>
            <CardDescription>
              Connect to your Google Sheet to track baby activity
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
                Paste the URL of your Google Sheet with Settings, Sleep, and Eat sheets
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
                    iOS PWAs have separate storage from Safari. Follow these
                    steps to migrate:
                  </p>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>
                      Click "Share Setup Link" and send to yourself (Messages,
                      Notes, etc.)
                    </li>
                    <li>Add this app to your home screen</li>
                    <li>
                      Alternative: Use "Copy Link" and paste in Settings →
                      Restore from Setup Link
                    </li>
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
                <CardTitle>Sheet Structure</CardTitle>
                <CardDescription>
                  Required sheet structure for Baby Dreams
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Required Sheets:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                    <li><strong>Settings</strong>: Setting | Value</li>
                    <li><strong>Sleep</strong>: Added Date | Date | Start Time | What | Cycle | Length</li>
                    <li><strong>Eat</strong>: Added Date | Date | Start Time | Volume | Cycle</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-4">
                    Make sure your spreadsheet has all three sheets with the correct column headers.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
