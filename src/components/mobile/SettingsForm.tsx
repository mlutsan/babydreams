import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BlockTitle, List, ListInput, Button, Card, ListButton, ListItem, Toast } from "konsta/react";
import { useToast } from "~/hooks/useToast";
import { getSheetMetadata } from "~/server/proxy";
import { getSettings, saveSettings } from "~/lib/settings-service";
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
  const { toast: toastState, isOpen: toastOpen, success, error, close: closeToast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [restoreLink, setRestoreLink] = useState("");

  // Load settings from Google Sheet when sheetUrl is set
  useEffect(() => {
    const load = async () => {
      if (!sheetUrl) {
        return;
      }
      setIsLoadingSettings(true);
      try {
        const res = await getSettings(sheetUrl);
        if (res.babyName) {
          setBabyName(res.babyName);
        }
        if (res.babyBirthdate) {
          setBabyBirthdate(res.babyBirthdate);
        }
      } catch (e) {
        console.error("Failed to load settings from sheet", e);
        error("Failed to load settings from sheet");
      } finally {
        setIsLoadingSettings(false);
      }
    };
    load();
  }, [sheetUrl, setBabyName, setBabyBirthdate]);

  const handleRestoreFromLink = () => {
    if (!restoreLink.trim()) {
      error("Please paste a setup link");
      return;
    }

    try {
      const url = new URL(restoreLink);
      const sheet = url.searchParams.get("sheet");

      if (!sheet) {
        error("Invalid link", {
          description: "No sheet URL found in the link",
        });
        return;
      }

      navigate({ to: "/invite", search: { sheet } });
    } catch {
      error("Invalid URL", {
        description: "Please paste a valid setup link",
      });
    }
  };

  const handleGenerateSetupLink = () => {
    const baseUrl = window.location.origin;
    const encodedSheet = encodeURIComponent(sheetUrl);
    const setupUrl = `${baseUrl}/invite?sheet=${encodedSheet}`;

    navigator.clipboard.writeText(setupUrl);
    success("Setup link copied!", {
      description: "Use this link to set up the app after installing to home screen",
      duration: 4000,
    });
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

      success("Sheet validated successfully!", {
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

  const handleSaveProfile = async () => {
    if (!sheetUrl) {
      error("Please configure your Google Sheet URL first");
      return;
    }
    setIsSavingSettings(true);
    try {
      await saveSettings({
        sheetUrl,
        babyName,
        babyBirthdate,
      });
      success("Baby profile saved to sheet");
    } catch (e) {
      console.error("Failed to save settings", e);
      error("Failed to save to sheet");
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-4">
      {!sheetUrl && (
        <>
          <BlockTitle>Restore from Setup Link</BlockTitle>

          <List strongIos insetIos>
            <ListInput
              label="Setup Link"
              type="text"
              placeholder="https://..."
              value={restoreLink}
              onChange={(e) => setRestoreLink(e.target.value)}
              info="Paste your setup link to migrate from Safari to PWA"
            />
          </List>
          <div className="p-2">
            <Button
              onClick={handleRestoreFromLink}
              disabled={!restoreLink.trim()}
              className="w-full"
              rounded
            >
              Restore Settings
            </Button>
          </div>
        </>
      )}

      <BlockTitle>Google Sheets Integration</BlockTitle>
      <List inset strong>
        <ListInput
          label="Google Sheet URL"
          type="url"
          outline
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          info="Paste the URL of your Google Sheet"
        />
        {errorMessage && (
          <ListItem
            className="text-sm text-red-600"
            text={
              <p className="text-sm text-red-600 dark:text-red-400">
                Error: {errorMessage}
              </p>
            }
          />
        )}
        <ListButton onClick={handleSaveAndTest}>
          {isConnecting ? "Validating..." : "Save & Test Connection"}
        </ListButton>
      </List>


      <BlockTitle>Baby Profile {isLoadingSettings ? "(loading...)" : ""}</BlockTitle>
      <List strongIos insetIos>
        <ListInput
          label="Baby Name"
          type="text"
          outline
          placeholder="Enter baby's name"
          value={babyName}
          onChange={(e) => setBabyName(e.target.value)}
          info="Your baby's name will appear throughout the app"
        />
        <ListInput
          label="Birthdate"
          type="date"
          outline
          value={babyBirthdate}
          onChange={(e) => setBabyBirthdate(e.target.value)}
        />

        {sheetUrl && <ListButton onClick={handleSaveProfile}>
          {isSavingSettings ? "Saving..." : "Update"}
        </ListButton>}
      </List>

      {/* {sheetUrl && (
        <div className="p-2">
          <Button
            onClick={handleSaveProfile}
            disabled={isSavingSettings}
            className="w-full"
            rounded
          >
            {isSavingSettings ? "Saving..." : "Save Baby Profile to Sheet"}
          </Button>
        </div>
      )} */}

      {sheetUrl && (
        <>
          <BlockTitle>PWA Migration</BlockTitle>

          <Card>
            <div className="p-4 space-y-3">
              <p className="text-sm font-medium">Installing as PWA?</p>
              <p className="text-sm opacity-70 mt-4">
                iOS PWAs have separate storage from Safari. Follow these steps:
              </p>
              <ol className="text-sm opacity-70 space-y-2 list-decimal list-inside">
                <li>Add this app to your home screen</li>
                <li>Copy link by tapping button below</li>
                <li>
                  Go to Settings in pinned app and paste the link into &quot;Restore
                  from Setup Link&quot;
                </li>
              </ol>
            </div>
            <Button
              onClick={handleGenerateSetupLink}
              className="w-full mt-4"
              rounded
              outline
            >
              <Link2 className="w-4 h-4 mr-2" />
              Copy Setup Link
            </Button>
          </Card>
        </>
      )}

      <Toast
        position="center"
        opened={toastOpen}
        button={
          <Button
            rounded
            clear
            small
            inline
            onClick={closeToast}
          >
            Close
          </Button>
        }
      >
        <div className="shrink">
          <div className="font-semibold">{toastState?.message}</div>
          {toastState?.description && (
            <div className="text-sm opacity-75 mt-1">{toastState.description}</div>
          )}
        </div>
      </Toast>
    </div>
  );
}
