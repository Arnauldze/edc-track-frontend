import { redirect } from "next/navigation";

// L'équipe se gère dans l'onglet « Équipe » de la fiche projet, qui applique
// les permissions du serveur. Cette ancienne page dupliquait cet onglet sans
// contrôle d'accès ; l'URL est conservée pour les liens existants.
export default async function ProjectTeamRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/projects/${id}`);
}
