import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Approx country centroids (lat, lng, default zoom for concession)
const COUNTRY_COORDS = {
  mauritanie: [20.0, -10.0, 5],
  senegal: [14.5, -14.5, 6],
  guinée: [10.0, -11.0, 6], guinea: [10.0, -11.0, 6],
  ghana: [7.5, -1.0, 6],
  nigeria: [9.0, 8.0, 6],
  mali: [17.0, -4.0, 5],
  niger: [17.0, 8.0, 5],
  rdc: [-2.0, 23.5, 5], congo: [-4.0, 15.0, 6],
  gabon: [-1.0, 11.7, 6],
  cameroun: [6.0, 12.5, 6],
  côte: [7.5, -5.5, 6], "côte d'ivoire": [7.5, -5.5, 6],
  mozambique: [-18.5, 35.0, 5],
  tanzanie: [-6.5, 35.0, 5],
  burkina: [12.5, -1.5, 6],
  zambie: [-13.5, 27.5, 5],
  afrique: [0, 20, 4], sahara: [0, 20, 4], default: [0, 20, 3],
};


function _coords(country) {
  const k = (country || "").toLowerCase().trim();
  for (const key of Object.keys(COUNTRY_COORDS)) {
    if (k.includes(key)) return COUNTRY_COORDS[key];
  }
  return COUNTRY_COORDS.default;
}


export default function ConcessionMap({ project, extracted }) {
  const country = project?.country || "Pays";
  const sector = project?.sector || "mines";
  const company = extracted?.company || "Entreprise";
  const zone = extracted?.zone_concession || "Zone non spécifiée";
  const [lat, lng, zoom] = _coords(country);

  return (
    <div className="rap-card p-4" data-testid="concession-map">
      <h3 className="font-display text-sm font-bold mb-2">Localisation de la concession</h3>
      <div className="rap-divider-gold w-12 mb-3" />
      <div className="text-xs mb-2 opacity-80">
        <b>Pays :</b> {country} · <b>Secteur :</b> {sector}
        {extracted?.zone_concession && <> · <b>Zone :</b> {zone}</>}
      </div>
      <div style={{ height: 300, borderRadius: 4, overflow: "hidden" }}>
        <MapContainer center={[lat, lng]} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          <Marker position={[lat, lng]}>
            <Popup>
              <b>{company}</b><br />
              {country} — {sector}<br />
              {zone}
            </Popup>
          </Marker>
          <Circle center={[lat, lng]} radius={120000}
            pathOptions={{ color: "#D4A017", fillColor: "#D4A017", fillOpacity: 0.15 }} />
        </MapContainer>
      </div>
      <p className="text-[10px] opacity-50 mt-2 italic">
        Localisation approximative basée sur le pays. Pour précision : extrayez les coordonnées GPS de la convention.
      </p>
    </div>
  );
}
