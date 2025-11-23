import { useCallback } from "react";
import { useAtom } from "jotai";
import { toastAtom, toastOpenAtom, type ToastMessage } from "~/lib/atoms";

export function useToast() {
  const [toast, setToast] = useAtom(toastAtom);
  const [isOpen, setIsOpen] = useAtom(toastOpenAtom);

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
  }, [setToast, setIsOpen]);

  const success = useCallback((
    message: string,
    options?: { description?: string; duration?: number; }
  ) => {
    showToast(message, { ...options, type: "success" });
  }, [showToast]);

  const error = useCallback((
    message: string,
    options?: { description?: string; duration?: number; }
  ) => {
    showToast(message, { ...options, type: "error" });
  }, [showToast]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  return {
    toast,
    isOpen,
    success,
    error,
    close,
  };
}
