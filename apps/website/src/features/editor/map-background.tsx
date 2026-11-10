export const mapBackgrounds = [
  { id: "dust2", name: "Dust II", image: "/branding/maps/dust2.webp" },
  { id: "nuke", name: "Nuke", image: "/branding/maps/nuke.webp" },
  { id: "overpass", name: "Overpass", image: "/branding/maps/overpass.webp" },
] as const;
export type MapBackgroundId = (typeof mapBackgrounds)[number]["id"];

export function MapBackground({ map }: { map: MapBackgroundId | null }) {
  const background = mapBackgrounds.find((item) => item.id === map);
  if (!background) return null;
  return (
    <img
      key={background.id}
      data-slot="map-background"
      alt=""
      aria-hidden="true"
      src={background.image}
      draggable={false}
      className="pointer-events-none absolute inset-0 size-full object-cover"
    />
  );
}
