import { useEffect, useRef, memo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Issue } from "@/types";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const statusColors: Record<string, string> = {
  Pending: "#f59e0b",
  Ongoing: "#3b82f6",
  Resolved: "#16a34a",
  Escalated: "#ef4444",
};

function createIcon(status: string) {
  const color = statusColors[status] || "#6b7280";
  return L.divIcon({
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3)"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

interface IssueMapProps {
  issues: Issue[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onMarkerClick?: (issue: Issue) => void;
  singlePin?: [number, number];
  draggablePin?: boolean;
  onPinMove?: (lat: number, lng: number) => void;
  /** Custom color function per issue — overrides status-based coloring */
  colorFn?: (issue: Issue) => string;
}

/**
 * Stable Leaflet map component.
 *
 * The map is initialised ONCE on mount. Pin moves and marker updates are
 * applied incrementally — the map never tears-down/recreates when the
 * user types in a nearby input field.
 *
 * Wrapped in React.memo with a value-based comparator so parent
 * re-renders (e.g. from controlled inputs) don't cause a re-render here.
 */
const IssueMap = memo(({
  issues,
  center = [18.5204, 73.8567],
  zoom = 12,
  height = "h-64",
  onMarkerClick,
  singlePin,
  draggablePin = false,
  onPinMove,
  colorFn,
}: IssueMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const pinRef = useRef<L.Marker | null>(null);

  // Keep callbacks in refs so effects never depend on them
  const onPinMoveRef = useRef(onPinMove);
  const onMarkerClickRef = useRef(onMarkerClick);
  const colorFnRef = useRef(colorFn);
  useEffect(() => { onPinMoveRef.current = onPinMove; }, [onPinMove]);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);
  useEffect(() => { colorFnRef.current = colorFn; }, [colorFn]);

  // ── 1. Initialise map ONCE ──────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: singlePin || center,
      zoom: singlePin ? 15 : zoom,
    });
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);

    // If singlePin is set at mount, create the draggable marker now
    if (singlePin) {
      const marker = L.marker(singlePin, { draggable: draggablePin }).addTo(map);
      if (draggablePin) {
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onPinMoveRef.current?.(pos.lat, pos.lng);
        });
      }
      pinRef.current = marker;
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      pinRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Move the single pin when coordinates change ──────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !singlePin) return;

    if (pinRef.current) {
      // Move existing pin — no tear-down
      pinRef.current.setLatLng(singlePin);
    } else {
      // First time after mount
      const marker = L.marker(singlePin, { draggable: draggablePin }).addTo(map);
      if (draggablePin) {
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onPinMoveRef.current?.(pos.lat, pos.lng);
        });
      }
      pinRef.current = marker;
    }

    const targetZoom = Math.max(map.getZoom(), 15);
    map.flyTo(singlePin, targetZoom, { duration: 1.2 });
  }, [singlePin, draggablePin]);


  // ── 3. Update issue markers when the issues array changes ───
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer || singlePin) return;

    layer.clearLayers();

    issues.forEach((issue) => {
      const color = colorFnRef.current ? colorFnRef.current(issue) : undefined;
      const icon = color
        ? L.divIcon({
            html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3)"></div>`,
            className: "",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })
        : createIcon(issue.status);

      const marker = L.marker([issue.lat, issue.lng], { icon }).addTo(layer);

      marker.bindPopup(`
        <div style="min-width:180px">
          <strong style="font-size:13px">${issue.title}</strong>
          <p style="color:#6b7280;font-size:12px;margin:4px 0">${issue.location}</p>
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500;color:white;background:${statusColors[issue.status]}">${issue.status}</span>
        </div>
      `);

      if (onMarkerClickRef.current) {
        const handler = onMarkerClickRef.current;
        marker.on("click", () => handler(issue));
      }
    });

    if (issues.length > 0) {
      const group = L.featureGroup(
        issues.map((i) => L.marker([i.lat, i.lng]))
      );
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [issues, singlePin]);

  return <div ref={mapRef} className={`${height} w-full rounded-xl z-0`} />;
}, (prev, next) => {
  // Value-based comparator — ignore callback identity changes
  if (prev.height !== next.height) return false;
  if (prev.zoom !== next.zoom) return false;
  if (prev.draggablePin !== next.draggablePin) return false;
  if (prev.issues !== next.issues) return false;
  if (prev.center?.[0] !== next.center?.[0] || prev.center?.[1] !== next.center?.[1]) return false;
  if (prev.singlePin?.[0] !== next.singlePin?.[0] || prev.singlePin?.[1] !== next.singlePin?.[1]) return false;
  return true;
});

IssueMap.displayName = "IssueMap";

export default IssueMap;
