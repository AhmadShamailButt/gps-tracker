"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Polygon,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import { Anomaly, AnomalySeverity, AnomalyType, Breach, BreachEvent, Location, Zone } from "@/lib/types";

const ANOMALY_LABEL: Record<AnomalyType, string> = {
  pattern_outlier: "Pattern outlier",
  abnormal_speed: "Abnormal speed",
  unexpected_stop: "Unexpected stop",
  teleportation: "Position jump",
};
import { useTheme } from "@/components/ThemeProvider";
import { useMapColors } from "@/lib/use-map-colors";
import MapControls from "@/components/MapControls";

function FollowMarker({
  position,
  trail,
}: {
  position: [number, number] | null;
  trail: [number, number][];
}) {
  const map = useMap();
  const firstFix = useRef(false);
  useEffect(() => {
    if (!position || firstFix.current) return;
    if (trail.length > 1) {
      const bounds = L.latLngBounds(trail);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 18 });
    } else {
      map.setView(position, 18);
    }
    firstFix.current = true;
  }, [position, trail, map]);
  return null;
}

function DrawControl({
  onPolygonCreated,
  drawColor,
  onDrawingChange,
}: {
  onPolygonCreated: (polygon: [number, number][]) => void;
  drawColor: string;
  onDrawingChange: (active: boolean) => void;
}) {
  const map = useMap();
  const onCreatedRef = useRef(onPolygonCreated);
  onCreatedRef.current = onPolygonCreated;
  const onDrawingChangeRef = useRef(onDrawingChange);
  onDrawingChangeRef.current = onDrawingChange;

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PolygonDraw = (L as any).Draw.Polygon;
    const polygonDrawer = new PolygonDraw(map, {
      allowIntersection: false,
      showArea: false,
      shapeOptions: { color: drawColor, weight: 2.5 },
    });

    const startDraw = () => {
      polygonDrawer.enable();
      onDrawingChangeRef.current(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleCreated = (e: any) => {
      const layer = e.layer as L.Polygon;
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      const ring: [number, number][] = latlngs.map((p) => [p.lat, p.lng]);
      onCreatedRef.current(ring);
      onDrawingChangeRef.current(false);
    };
    const handleStop = () => onDrawingChangeRef.current(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on((L as any).Draw.Event.CREATED, handleCreated);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on((L as any).Draw.Event.DRAWSTOP, handleStop);

    const onTrigger = () => startDraw();
    window.addEventListener("gps:start-draw", onTrigger);

    return () => {
      window.removeEventListener("gps:start-draw", onTrigger);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.off((L as any).Draw.Event.CREATED, handleCreated);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.off((L as any).Draw.Event.DRAWSTOP, handleStop);
      polygonDrawer.disable();
      map.removeLayer(drawnItems);
    };
  }, [map, drawColor]);

  return null;
}

export function startDrawingZone() {
  window.dispatchEvent(new CustomEvent("gps:start-draw"));
}

export type MapViewProps = {
  trail: Location[];
  latest: Location | null;
  zones: Zone[];
  breach: Breach | null;
  anomalies?: Anomaly[];
  breaches?: BreachEvent[];
  onPolygonCreated: (polygon: [number, number][]) => void;
  onZoneClick: (zone: Zone) => void;
};

const DEFAULT_CENTER: [number, number] = [31.5204, 74.3587]; // Lahore fallback

const LIGHT_TILES =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const DARK_TILES =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function fanByCoord<T extends { lat: number; lng: number }>(
  items: T[]
): { item: T; lat: number; lng: number }[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const key = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
    const idx = seen.get(key) ?? 0;
    seen.set(key, idx + 1);
    if (idx === 0) return { item, lat: item.lat, lng: item.lng };
    const angle = (idx * Math.PI * 2) / 6;
    const offset = 0.00012 * (1 + Math.floor(idx / 6));
    return {
      item,
      lat: item.lat + Math.sin(angle) * offset,
      lng: item.lng + Math.cos(angle) * offset,
    };
  });
}

function anomalyColor(
  severity: AnomalySeverity,
  c: { anomalyHigh: string; anomalyMedium: string; anomalyLow: string }
): string {
  if (severity === "high") return c.anomalyHigh;
  if (severity === "medium") return c.anomalyMedium;
  return c.anomalyLow;
}

export default function MapView({
  trail,
  latest,
  zones,
  breach,
  anomalies = [],
  breaches = [],
  onPolygonCreated,
  onZoneClick,
}: MapViewProps) {
  const { theme } = useTheme();
  const c = useMapColors();
  const [isDrawing, setIsDrawing] = useState(false);

  const trailPositions = useMemo(
    () => trail.map((l) => [l.lat, l.lng] as [number, number]),
    [trail]
  );
  const latestPos: [number, number] | null = latest ? [latest.lat, latest.lng] : null;
  const center = latestPos ?? DEFAULT_CENTER;

  const fannedAnomalies = useMemo(() => fanByCoord(anomalies), [anomalies]);
  const fannedBreaches = useMemo(() => fanByCoord(breaches), [breaches]);

  return (
    <MapContainer
      center={center}
      zoom={13}
      zoomControl={false}
      style={{ height: "100%", width: "100%", background: c.tileBg }}
    >
      <TileLayer
        key={theme}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={theme === "dark" ? DARK_TILES : LIGHT_TILES}
        subdomains="abcd"
        maxZoom={19}
      />

      <DrawControl
        onPolygonCreated={onPolygonCreated}
        drawColor={c.marker}
        onDrawingChange={setIsDrawing}
      />
      <FollowMarker position={latestPos} trail={trailPositions} />

      {zones.map((z) => {
        const restricted = z.type === "restricted";
        const color = restricted ? c.restricted : c.allowed;
        const cx =
          z.polygon.reduce((s, [lat]) => s + lat, 0) / Math.max(1, z.polygon.length);
        const cy =
          z.polygon.reduce((s, [, lng]) => s + lng, 0) / Math.max(1, z.polygon.length);
        return (
          <Polygon
            key={z.id}
            positions={z.polygon}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: restricted ? 0.22 : 0.16,
              weight: 2.5,
              opacity: 0.95,
              dashArray: restricted ? "6 4" : undefined,
            }}
            eventHandlers={{ click: () => onZoneClick(z) }}
          >
            <Tooltip direction="top" sticky opacity={1} className="gps-zone-tooltip">
              <div style={{ minWidth: 180 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: color,
                      display: "inline-block",
                    }}
                  />
                  <strong style={{ fontSize: 13 }}>{z.name}</strong>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      padding: "2px 6px",
                      borderRadius: 999,
                      background: restricted ? "var(--color-pastel-rose)" : "var(--color-pastel-green)",
                      color: restricted ? "var(--color-on-rose)" : "var(--color-on-green)",
                    }}
                  >
                    {restricted ? "Restricted" : "Allowed"}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    color: c.mutedForeground,
                    fontSize: 11,
                    lineHeight: 1.4,
                  }}
                >
                  {restricted
                    ? "Triggers a breach alert when the device enters this area."
                    : "Triggers a breach alert when the device leaves this area."}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: `1px solid ${c.mutedForeground}33`,
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    columnGap: 8,
                    rowGap: 2,
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: c.mutedForeground, fontVariantNumeric: "tabular-nums" }}>
                    Center
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: c.foreground }}>
                    {cx.toFixed(5)}, {cy.toFixed(5)}
                  </span>
                  <span style={{ color: c.mutedForeground }}>Points</span>
                  <span style={{ color: c.foreground }}>{z.polygon.length}</span>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    color: c.mutedForeground,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Click polygon to delete
                </div>
              </div>
            </Tooltip>
          </Polygon>
        );
      })}

      {trailPositions.length > 1 && (
        <Polyline
          positions={trailPositions}
          pathOptions={{
            color: c.trail,
            weight: 3,
            opacity: 0.55,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      )}

      {trail.slice(0, -1).map((p, i) => (
        <CircleMarker
          key={`hist-${i}`}
          center={[p.lat, p.lng]}
          radius={3}
          interactive
          bubblingMouseEvents={false}
          pathOptions={{
            color: c.trail,
            fillColor: c.trail,
            fillOpacity: 0.4,
            weight: 0,
          }}
          eventHandlers={{
            mouseover: (e) => e.target.openPopup(),
            mouseout: (e) => e.target.closePopup(),
          }}
        >
          <Popup
            closeButton={false}
            autoPan={false}
            offset={L.point(0, -8)}
            closeOnClick={false}
            className="gps-anomaly-popup"
          >
            <div style={{ fontFamily: "inherit", fontSize: 12, color: c.foreground, minWidth: 180 }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 8, rowGap: 2 }}>
                <span style={{ color: c.mutedForeground }}>Location</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
                <span style={{ color: c.mutedForeground }}>Speed</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{p.speed.toFixed(1)} km/h</span>
                <span style={{ color: c.mutedForeground }}>Satellites</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{p.satellites}</span>
                <span style={{ color: c.mutedForeground }}>Time</span>
                <span>{new Date(p.ts).toLocaleString()}</span>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {latestPos && (
        <>
          {breach && (
            <CircleMarker
              center={latestPos}
              radius={18}
              pathOptions={{
                color: c.breach,
                fillColor: c.breach,
                fillOpacity: 0.15,
                weight: 0,
              }}
            />
          )}
          <CircleMarker
            center={latestPos}
            radius={9}
            interactive
            bubblingMouseEvents={false}
            pathOptions={{
              color: c.card,
              fillColor: breach ? c.breach : c.marker,
              fillOpacity: 1,
              weight: 3,
              opacity: 1,
            }}
            eventHandlers={{
              mouseover: (e) => e.target.openPopup(),
              mouseout: (e) => e.target.closePopup(),
            }}
          >
            <Popup
              closeButton={false}
              autoPan={false}
              offset={L.point(0, -12)}
              closeOnClick={false}
              className="gps-anomaly-popup"
            >
              <div style={{ fontFamily: "inherit", fontSize: 13, color: c.foreground, minWidth: 220 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: breach ? c.breach : c.marker,
                    }}
                  />
                  <strong>{latest?.deviceId ?? "Device"}</strong>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      color: breach ? c.breach : c.mutedForeground,
                      fontWeight: breach ? 700 : 400,
                    }}
                  >
                    {breach ? "Breach" : "Live"}
                  </span>
                </div>
                {breach && (
                  <div style={{ marginTop: 6, fontSize: 12, color: c.breach }}>
                    {breach.reason === "inside-restricted"
                      ? `Inside restricted: ${breach.zoneName}`
                      : `Outside allowed: ${breach.zoneName}`}
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 11, color: c.mutedForeground, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 8, rowGap: 2 }}>
                  <span>Location</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{latest?.lat.toFixed(5)}, {latest?.lng.toFixed(5)}</span>
                  <span>Speed</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{latest?.speed.toFixed(1)} km/h</span>
                  <span>Satellites</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{latest?.satellites ?? "—"}</span>
                  {latest?.ts && (
                    <>
                      <span>Updated</span>
                      <span>{new Date(latest.ts).toLocaleTimeString()}</span>
                    </>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
          <CircleMarker
            center={latestPos}
            radius={3}
            pathOptions={{
              color: c.card,
              fillColor: c.card,
              fillOpacity: 1,
              weight: 0,
            }}
          />
        </>
      )}

      {fannedAnomalies.map(({ item: a, lat, lng }) => {
        const color = anomalyColor(a.severity, c);
        return (
            <CircleMarker
              key={a.id}
              center={[lat, lng]}
              radius={8}
              interactive
              bubblingMouseEvents={false}
              pathOptions={{
                color: c.card,
                fillColor: color,
                fillOpacity: 1,
                weight: 2,
                opacity: 1,
              }}
              eventHandlers={{
                mouseover: (e) => e.target.openPopup(),
                mouseout: (e) => e.target.closePopup(),
              }}
            >
              <Popup
                closeButton={false}
                autoPan={false}
                offset={L.point(0, -12)}
                closeOnClick={false}
                className="gps-anomaly-popup"
              >
                <div style={{ fontFamily: "inherit", fontSize: 13, color: c.foreground, minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: color,
                      }}
                    />
                    <strong>{ANOMALY_LABEL[a.type]}</strong>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: c.mutedForeground,
                      }}
                    >
                      {a.severity}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12 }}>{a.reason}</div>
                  <div style={{ marginTop: 6, fontSize: 11, color: c.mutedForeground, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 8, rowGap: 2 }}>
                    <span>Score</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{a.score.toFixed(3)}</span>
                    <span>Location</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{a.lat.toFixed(5)}, {a.lng.toFixed(5)}</span>
                    <span>Detected</span>
                    <span>{new Date(a.detectedAt).toLocaleString()}</span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

      {fannedBreaches.map(({ item: b, lat, lng }) => {
        const isRestricted = b.reason === "inside-restricted";
        const isOngoing = !b.clearedAt;
        return (
            <CircleMarker
              key={b.id}
              center={[lat, lng]}
              radius={7}
              interactive
              bubblingMouseEvents={false}
              pathOptions={{
                color: c.card,
                fillColor: c.breach,
                fillOpacity: isOngoing ? 1 : 0.55,
                weight: 2,
                opacity: 1,
                dashArray: isOngoing ? undefined : "2 3",
              }}
              eventHandlers={{
                mouseover: (e) => e.target.openPopup(),
                mouseout: (e) => e.target.closePopup(),
              }}
            >
              <Popup
                closeButton={false}
                autoPan={false}
                offset={L.point(0, -12)}
                closeOnClick={false}
                className="gps-anomaly-popup"
              >
                <div style={{ fontFamily: "inherit", fontSize: 13, color: c.foreground, minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: c.breach,
                      }}
                    />
                    <strong>{b.zoneName}</strong>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: c.mutedForeground,
                      }}
                    >
                      {isOngoing ? "Live" : "Cleared"}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    {isRestricted ? "Entered restricted zone" : "Left allowed zone"}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: c.mutedForeground, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 8, rowGap: 2 }}>
                    <span>Entered</span>
                    <span>{new Date(b.enteredAt).toLocaleString()}</span>
                    {b.clearedAt && (
                      <>
                        <span>Cleared</span>
                        <span>{new Date(b.clearedAt).toLocaleString()}</span>
                      </>
                    )}
                    <span>Location</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{b.lat.toFixed(5)}, {b.lng.toFixed(5)}</span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

      <MapControls centerOn={latestPos} isDrawing={isDrawing} />
    </MapContainer>
  );
}
