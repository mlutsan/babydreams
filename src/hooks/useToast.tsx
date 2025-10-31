import { useState, useCallback } from "react";

export interface ToastMessage {
  id: string;
  message: string;
  description?: string;
  type: "success" | "error";
  duration?: number;
}

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const showToast = useCallback((
    message: string,
    options?: {
      description?: string;
      type?: "success" | "error";
      duration?: number;
    }
  ) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: ToastMessage = {
      id,
      message,
      description: options?.description,
      type: options?.type || "success",
      duration: options?.duration || 3000,
    };

    setToast(newToast);
    setIsOpen(true);

    // Auto-close after duration
    setTimeout(() => {
      setIsOpen(false);
    }, newToast.duration);
  }, []);

  const success = useCallback((
    message: string,
    options?: { description?: string; duration?: number }
  ) => {
    showToast(message, { ...options, type: "success" });
  }, [showToast]);

  const error = useCallback((
    message: string,
    options?: { description?: string; duration?: number }
  ) => {
    showToast(message, { ...options, type: "error" });
  }, [showToast]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    toast,
    isOpen,
    success,
    error,
    close,
  };
}
