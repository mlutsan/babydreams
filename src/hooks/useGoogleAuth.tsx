/**
 * useGoogleAuth Hook
 * Manages Google Identity Services authentication and authorization
 */

import { useEffect, useRef } from "react";
import { useAtom } from "jotai";
import {
  authStateAtom,
  googleUserAtom,
  googleTokenAtom,
  type AuthState,
  type GoogleUser,
} from "~/lib/atoms";

declare const google: any;

export interface GsiButtonConfiguration {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
}

interface UseGoogleAuthReturn {
  authState: AuthState;
  user: GoogleUser | null;
  requestSheetsAccess: () => void;
  renderButton: (parent: HTMLElement, options?: GsiButtonConfiguration) => void;
  logout: () => void;
}

export function useGoogleAuth(): UseGoogleAuthReturn {
  const tokenClient = useRef<any>(null);
  const [authState, setAuthState] = useAtom(authStateAtom);
  const [user, setUser] = useAtom(googleUserAtom);
  const [, setToken] = useAtom(googleTokenAtom);

  useEffect(() => {
    // Check if user is already signed in
    // if (user) {
    //   setAuthState("signed-in");
    // }
    // Initialize Google Identity Services for Authentication (sign-in)
    // google.accounts.id.initialize({
    //   client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    //   callback: handleCredentialResponse,
    //   //auto_select: true,
    // });

    // // Show the One Tap prompt only if not signed in
    // if (!user) {
    //   google.accounts.id.prompt();
    // }

    // Initialize OAuth2 token client for API access (Sheets API)
    tokenClient.current = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope:
        "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email",
      callback: handleTokenResponse,
      prompt: "",
      login_hint: user?.email
    });
  }, []);

  function handleCredentialResponse(response: { credential: string; }) {
    try {
      // Decode the JWT to get user info
      const payload = JSON.parse(atob(response.credential.split(".")[1]));

      const userProfile: GoogleUser = {
        name: payload.name || payload.email,
        email: payload.email,
        picture: payload.picture,
      };

      setUser(userProfile);
      setAuthState("signed-in");
      console.log("Signed in as:", userProfile.email);

      // Automatically request Sheets access after sign-in
      // This creates a single-roundtrip experience
      if (tokenClient.current) {
        console.log("Auto-requesting Sheets access...");
        // Use prompt: "" for silent renewal if user previously consented
        tokenClient.current.requestAccessToken({ prompt: "" });
      }
    } catch (error) {
      console.error("Failed to decode credential:", error);
      setAuthState("error");
    }
  }

  function handleTokenResponse(response: { access_token: string; expires_in: number; }) {
    if (response.access_token) {
      setToken({
        accessToken: response.access_token,
        expiresAt: Date.now() + response.expires_in * 1000,
      });

      console.log("Access token obtained for Sheets API");
      // Trigger event for backwards compatibility
      window.dispatchEvent(new Event("google-token-received"));
    }
  }

  function requestSheetsAccess() {
    if (tokenClient.current) {
      tokenClient.current.requestAccessToken({
        login_hint: user?.email,
        prompt: ""
      });
    } else {
      console.error("Token client not initialized");
    }
  }

  function renderButton(parent: HTMLElement, options?: GsiButtonConfiguration) {
    if (!google?.accounts?.id) {
      console.error("Google Identity Services not loaded");
      return;
    }

    const defaultOptions: GsiButtonConfiguration = {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      ...options,
    };

    google.accounts.id.renderButton(parent, defaultOptions);
  }

  function logout() {
    // Clear user data and tokens
    setUser(null);
    setToken(null);
    setAuthState("signed-out");

    // Sign out from Google Identity Services
    if (google?.accounts?.id) {
      google.accounts.id.disableAutoSelect();
    }

    console.log("Logged out successfully");
  }

  return {
    authState,
    user,
    requestSheetsAccess,
    renderButton,
    logout,
  };
}
