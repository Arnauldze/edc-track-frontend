"use client";

// ══════════════════════════════════════════════════════════════
// ARCHIVES D'UN PROJET
// La page charge le projet ; tout le reste (arbre, dossiers, documents,
// validation) est l'affaire de l'explorateur.
// ══════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProjectById } from "@/lib/projectStore";
import { ArchiveExplorer, type ProjetArchive } from "@/components/archives/ArchiveExplorer";

export default function ArchivesProjetPage() {
  const params = useParams();
  const code = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [projet, setProjet] = useState<ProjetArchive | null>(null);
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    let vivant = true;
    getProjectById(code).then((stored) => {
      if (!vivant) return;
      if (!stored) {
        setIntrouvable(true);
        return;
      }
      setProjet({ code: stored.code, name: stored.name, components: stored.components });
    });
    return () => {
      vivant = false;
    };
  }, [code]);

  if (introuvable) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[15px] font-semibold text-fg">Projet introuvable</p>
        <p className="text-[13px] text-fg-muted">Ce projet n&apos;existe pas, ou il ne fait pas partie de ceux qui vous sont accessibles.</p>
        <Link href="/archives" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-fg hover:underline">
          <ArrowLeft size={15} /> Retour aux archives
        </Link>
      </div>
    );
  }

  if (!projet) {
    return <p className="p-6 text-[13px] text-fg-muted">Chargement du projet…</p>;
  }

  return <ArchiveExplorer projet={projet} />;
}
