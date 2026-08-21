import Link from "next/link";
import Logo from "@/components/Logo";
import PortailRedirection from "@/components/PortailRedirection";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-100 px-6 py-16">
      <main className="w-full max-w-2xl">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo variant="full" className="mb-4" />
          <h1 className="sr-only">Fluxya</h1>
          <p className="mt-2 text-zinc-600">
            Choisis l&apos;application à ouvrir
          </p>
          {/* Déjà connecté ? On ouvre directement la bonne application
              (l'icône du téléphone menait toujours au technicien). */}
          <PortailRedirection />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin"
            className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors hover:border-black hover:bg-black hover:text-white"
          >
            <span className="text-lg font-bold">Administration</span>
            <span className="mt-1 text-sm text-zinc-500 group-hover:text-zinc-300">
              Devis, projets, clients, utilisateurs, tableaux de bord
            </span>
          </Link>

          <Link
            href="/technicien"
            className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors hover:border-black hover:bg-black hover:text-white"
          >
            <span className="text-lg font-bold">Technicien</span>
            <span className="mt-1 text-sm text-zinc-500 group-hover:text-zinc-300">
              Application terrain (PWA) : tâches, travaux, photos
            </span>
          </Link>
        </div>

        <p className="mt-10 text-center text-xs text-zinc-400">
          Mode test — connexion requise, données synchronisées avec Supabase.
        </p>
      </main>
    </div>
  );
}
