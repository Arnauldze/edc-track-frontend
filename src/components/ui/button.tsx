import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost";
    loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", loading, children, ...props }, ref) => {

        // Style de base
        const baseStyles = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background";

        // Variantes de style
        const variants = {
            primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm", // Le bouton bleu principal
            secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
            outline: "border border-gray-300 bg-transparent hover:bg-gray-100 text-gray-700",
            ghost: "hover:bg-gray-100 hover:text-gray-900",
        };

        // Taille par défaut (h-10 px-4 py-2)
        const sizes = "h-10 py-2 px-4 w-full"; // w-full pour prendre toute la largeur comme dans la maquette

        return (
            <button
                className={cn(baseStyles, variants[variant], sizes, className)}
                ref={ref}
                disabled={props.disabled || loading}
                {...props}
            >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";

export { Button };
