import type mapboxgl from "mapbox-gl";

export const OPEN_STREET_MAP_STYLE: mapboxgl.StyleSpecification = {
  version: 8,
  sources: {
    openStreetMap: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      minzoom: 0,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#e6f0f7" },
    },
    {
      id: "open-street-map",
      type: "raster",
      source: "openStreetMap",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};
