import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, AlertCircle } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean; // Permet d'afficher la bordure rouge
    leftIcon?: LucideIcon; // Icône à gauche (ex: Email, Lock)
    rightIcon?: React.ReactNode; // Icône à droite (ex: Eye button)
    fullWidth?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, leftIcon: LeftIcon, rightIcon, fullWidth = true, ...props }, ref) => {
        return (
            <div className={cn("relative flex items-center", fullWidth && "w-full")}>
                {/* Style de base: h-10, rounded-md, border gray-300 */}
                {LeftIcon && (
                    <div className="absolute left-3 text-gray-400 pointer-events-none">
                        <LeftIcon size={18} />
                    </div>
                )}

                <input
                    type={type}
                    className={cn(
                        "flex h-11 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
                        LeftIcon && "pl-10", // Espace pour l'icône gauche
                        rightIcon && "pr-10", // Espace pour l'icône droite
                        error && "border-red-300 bg-red-50 text-red-900 focus-visible:ring-red-500 focus-visible:border-red-500 placeholder:text-red-300", // Style d'erreur
                        className
                    )}
                    ref={ref}
                    {...props}
                />

                {/* Gestion de l'icône de droite (Error ou Custom comme Eye) */}
                <div className="absolute right-3 flex items-center">
                    {error ? (
                        <AlertCircle className="text-red-500 h-5 w-5" />
                    ) : (
                        rightIcon
                    )}
                </div>
            </div>
        );
    }
);
Input.displayName = "Input";

export { Input };
