// ══════════════════════════════════════
// TOAST STORE — Notifications après actions
// ══════════════════════════════════════

export type ToastType = "success" | "error" | "info";

export type Toast = {
    id: number;
    message: string;
    type: ToastType;
};

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let listeners: Listener[] = [];
let idCounter = 0;

function notify() {
    listeners.forEach((l) => l([...toasts]));
}

function addToast(message: string, type: ToastType, duration = 3500) {
    const id = ++idCounter;
    toasts = [...toasts, { id, message, type }];
    notify();
    if (duration > 0) {
        setTimeout(() => {
            toasts = toasts.filter((t) => t.id !== id);
            notify();
        }, duration);
    }
}

export const toast = {
    success: (message: string) => addToast(message, "success"),
    error: (message: string) => addToast(message, "error"),
    info: (message: string) => addToast(message, "info"),
};

export function subscribeToasts(listener: Listener): () => void {
    listeners.push(listener);
    listener([...toasts]);
    return () => {
        listeners = listeners.filter((l) => l !== listener);
    };
}
