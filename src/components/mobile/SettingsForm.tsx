import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Block, BlockTitle, List, ListInput, Button, Card, ListButton, ListItem } from "konsta/react";
import { getMetadata } from "~/server/auth";
import { generateRandomName } from "~/lib/atoms";
import { Link2, Shuffle } from "lucide-react";

interface SettingsFormProps {
  sheetUrl: string;
  userName: string;
  setSheetUrl: (url: string) => void;
  setUserName: (name: string) => void;
}

export function SettingsForm({
  sheetUrl,
  userName,
  setSheetUrl,
  setUserName,
}: SettingsFormProps) {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [restoreLink, setRestoreLink] = useState("");

  const handleGenerateNewName = () => {
    setUserName(generateRandomName());
  };

  const handleGenerateInviteLink = () => {
    const baseUrl = window.location.origin;
    const encodedSheet = encodeURIComponent(sheetUrl);
    const inviteUrl = `${baseUrl}/invite?sheet=${encodedSheet}`;

    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied!", {
      description: "Share this link with your family members",
      duration: 3000,
    });
  };

  const handleGenerateSetupLink = () => {
    const baseUrl = window.location.origin;
    const encodedSheet = encodeURIComponent(sheetUrl);
    const encodedName = encodeURIComponent(userName);
    const setupUrl = `${baseUrl}/invite?sheet=${encodedSheet}&name=${encodedName}`;

    navigator.clipboard.writeText(setupUrl);
    toast.success("Setup link copied!", {
      description: "Use this link to set up the app after installing to home screen",
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
      const name = url.searchParams.get("name");

      if (!sheet) {
        toast.error("Invalid link", {
          description: "No sheet URL found in the link",
        });
        return;
      }

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
      const result = await getMetadata({ data: { sheetUrl } });

      const sheetsInfo = result.sheets
        .map((sheet: { title: string }) => sheet.title)
        .join(", ");

      toast.success("Sheet validated successfully!", {
        description: `${result.title} (${result.sheetCount} sheets: ${sheetsInfo})`,
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
      <BlockTitle>Your Name</BlockTitle>
      <List strongIos insetIos>
        <ListInput
          label="Display Name"
          type="text"
          outline
          placeholder="Enter your name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          info="This name will be used to identify your expenses"
        />
        <ListButton onClick={handleGenerateNewName}>
          <Shuffle className="w-5 h-5 mr-2" />
          Generate Random Name
        </ListButton>
      </List>

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
                  Go to Settings in pinned app and paste the link into "Restore
                  from Setup Link"
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

          <BlockTitle>Invite Family</BlockTitle>
          <Block strong inset className="mb-24">
            <div className="p-4 space-y-3">
              <p className="text-sm opacity-70">
                Generate an invite link with your Google Sheet configuration.
                Family members can enter their name and start tracking expenses.
              </p>
            </div>
            <Button
              onClick={handleGenerateInviteLink}
              className="w-full"
              rounded
              outline
            >
              <Link2 className="w-4 h-4 mr-2" />
              Generate Invite Link
            </Button>
          </Block>
        </>
      )}
    </div>
  );
}
