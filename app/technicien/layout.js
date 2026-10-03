// Segment /technicien : sert uniquement à écrire la balise viewport côté
// serveur (zoom iPhone — voir lib/viewportSansZoomIos.js). La page est inchangée.
import { viewportSansZoomIos } from "@/lib/viewportSansZoomIos";

export async function generateViewport() {
  return viewportSansZoomIos();
}

export default function LayoutTechnicien({ children }) {
  return children;
}
