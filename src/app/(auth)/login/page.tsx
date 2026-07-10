"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "@/lib/authStore";
import { getErrorMessage } from "@/services/api/client";

export default function LoginPage() {
    const router = useRouter();
    const [loginId, setLoginId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await login({
                login: loginId,
                password: password,
            });
            
            router.push("/dashboard");
        } catch (err: any) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Logo & Name - Top Left (visible on all screens) */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg overflow-hidden shadow-lg bg-white p-1">
                    <Image 
                        src="/edc_logo.jpg" 
                        alt="EDC Logo" 
                        width={40} 
                        height={40} 
                        className="w-full h-full object-contain"
                    />
                </div>
                <div className="text-left">
                    <h1 className="text-base font-bold text-white">EDC Track</h1>
                    <p className="text-blue-100 text-[10px]">Gestion de Projets</p>
                </div>
            </div>

            {/* Left Panel - Brand */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 relative overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute top-20 left-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl"></div>
                
                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 text-white">
                    {/* Welcome Message */}
                    <div className="text-center max-w-md">
                        <h2 className="text-3xl font-bold mb-3">
                            Bienvenue
                        </h2>
                        <div className="w-16 h-0.5 bg-white/30 mx-auto mb-4"></div>
                        <p className="text-blue-100 text-base leading-relaxed">
                            Plateforme de gestion et de suivi des projets d'infrastructure électrique au Cameroun
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    {/* Form Card */}
                    <div className="bg-white rounded-xl shadow-xl p-6 border border-gray-100">
                        {/* Header */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">
                                Connexion
                            </h2>
                            <p className="text-sm text-gray-600">
                                Accédez à votre espace de gestion
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 rounded-lg bg-red-50 p-3 border border-red-200 flex items-start">
                                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                                <div className="flex-1">
                                    <h3 className="text-xs font-medium text-red-800">Échec de connexion</h3>
                                    <p className="text-xs text-red-700 mt-0.5">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Form */}
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            {/* Login Field */}
                            <div>
                                <label htmlFor="login" className="block text-xs font-medium text-gray-700 mb-1">
                                    Identifiant
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <Input
                                        id="login"
                                        name="login"
                                        type="text"
                                        autoComplete="off"
                                        required
                                        placeholder="Votre identifiant"
                                        value={loginId}
                                        onChange={(e) => setLoginId(e.target.value)}
                                        className="pl-9 h-10 text-sm"
                                        data-form-type="other"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div>
                                <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                                    Mot de passe
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="off"
                                        required
                                        placeholder="Votre mot de passe"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-9 pr-9 h-10 text-sm"
                                        data-form-type="password"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="focus:outline-none text-gray-400 hover:text-gray-600 transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Remember Me & Forgot Password */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        id="remember-me"
                                        name="remember-me"
                                        type="checkbox"
                                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label htmlFor="remember-me" className="ml-2 block text-xs text-gray-700 cursor-pointer">
                                        Se souvenir de moi
                                    </label>
                                </div>
                                <a href="#" className="text-xs font-medium text-blue-600 hover:text-blue-500">
                                    Mot de passe oublié ?
                                </a>
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className="w-full h-10 text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                                disabled={loading}
                                loading={loading}
                            >
                                {loading ? "Connexion..." : "Se connecter"}
                            </Button>

                            {/* Demo Credentials */}
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-[10px] text-blue-800 text-center">
                                    <strong>Démo:</strong> Identifiant: <code className="bg-blue-100 px-1.5 py-0.5 rounded">admin</code> / 
                                    Mot de passe: <code className="bg-blue-100 px-1.5 py-0.5 rounded">admin123</code>
                                </p>
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
                    <p className="mt-4 text-center text-[10px] text-gray-500">
                        © 2026 Electricity Development Corporation. Tous droits réservés.
                    </p>
                </div>
            </div>
        </div>
    );
}
