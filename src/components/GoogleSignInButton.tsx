/**
 * Example component showing how to use the Google Sign-In button
 * with the useGoogleAuth hook
 */

import React from "react";
import { useEffect, useRef } from "react";
import { useGoogleAuth, type GsiButtonConfiguration } from "~/hooks/useGoogleAuth";

interface GoogleSignInButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  options?: GsiButtonConfiguration;
}

export function GoogleSignInButton({ options }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const { renderButton, authState } = useGoogleAuth();

  useEffect(() => {
    if (buttonRef.current && authState === "signed-out") {
      renderButton(buttonRef.current, options);
    }
  }, [authState, options, renderButton]);

  // Don't show button if user is already signed in
  if (authState !== "signed-out") {
    return null;
  }

  return <div ref={buttonRef} {...options} />;
}

export default GoogleSignInButton;
