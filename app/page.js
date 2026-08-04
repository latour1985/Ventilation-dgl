import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-100 px-6 py-16">
      <main className="w-full max-w-2xl">
        <div className="mb-10 flex flex-col items-center text-center">
          <Image
            src="/logo-dgl.png"
            alt="Ventilation DGL inc."
            width={229}
            height={200}
            priority
            className="mb-5 h-20 w-auto"
          />
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Ventilation DGL inc.
          </h1>
          <p className="mt-2 text-zinc-600">
            Choisis l&apos;application à ouvrir
          </p>
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
