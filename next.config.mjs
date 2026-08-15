/** @type {import('next').NextConfig} */
const nextConfig = {
  // FAUTES DE FRAPPE PARDONNÉES — les variantes proches des vraies
  // adresses redirigent vers la bonne porte au lieu d'un 404 sec.
  // (Le propriétaire a tapé /plateform et s'est cogné au mur — plus
  // jamais, ni pour lui ni pour un futur employé.)
  async redirects() {
    return [
      { source: "/plateform", destination: "/plateforme", permanent: false },
      { source: "/platform", destination: "/plateforme", permanent: false },
      { source: "/plate-forme", destination: "/plateforme", permanent: false },
      { source: "/technicient", destination: "/technicien", permanent: false },
      { source: "/tech", destination: "/technicien", permanent: false },
    ];
  },
};

export default nextConfig;
