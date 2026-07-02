import React, { useRef, useEffect, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { getCat, ThemeColors } from "@/src/theme";
import { useThemedStyles } from "@/src/theme-context";

// Hide Google's POI / transit / business clutter so only our pins stand out.
const MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

const catIcon = (c?: string) => (c === "groomer" ? "cut" : c === "both" ? "ribbon" : "storefront");

export default function MapShops({
  shops,
  region,
  focusId,
  onSelect,
  interactive = true,
  delta = 0.04,
}: {
  shops: any[];
  region?: { latitude: number; longitude: number };
  focusId?: string;
  onSelect?: (s: any) => void;
  interactive?: boolean;
  delta?: number;
}) {
  const mapRef = useRef<MapView>(null);
  const styles = useThemedStyles(makeStyles);
  const center = region || { latitude: 37.9838, longitude: 23.7275 };

  // Custom marker views (vector icons) render blank on Android when tracksViewChanges
  // is false from the start — the pin is snapshotted before the icon font paints.
  // So we track changes briefly whenever the pins change, then stop for performance.
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const timer = setTimeout(() => setTracks(false), 1200);
    return () => clearTimeout(timer);
  }, [shops.length, focusId]);

  // Re-center when the resolved location (GPS / search) changes.
  useEffect(() => {
    if (!region) return;
    mapRef.current?.animateToRegion(
      { latitude: region.latitude, longitude: region.longitude, latitudeDelta: delta, longitudeDelta: delta },
      350,
    );
  }, [region?.latitude, region?.longitude, delta]);

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsTraffic={false}
        showsBuildings={false}
        customMapStyle={MAP_STYLE}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        pitchEnabled={interactive}
        rotateEnabled={interactive}
        toolbarEnabled={false}
        testID="shops-map"
      >
        {shops
          .filter((s) => s.latitude && s.longitude)
          .map((s) => {
            const focused = focusId != null && String(s.id) === String(focusId);
            const c = getCat(s.category);
            return (
              <Marker
                key={s.id}
                coordinate={{ latitude: s.latitude, longitude: s.longitude }}
                onPress={() => onSelect?.(s)}
                zIndex={focused ? 10 : 1}
                tracksViewChanges={tracks}
              >
                <View style={[styles.pin, { backgroundColor: c.main }, focused && styles.pinFocused]}>
                  <Ionicons name={catIcon(s.category) as any} size={17} color="#fff" />
                </View>
              </Marker>
            );
          })}
      </MapView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: { flex: 1 },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  pinFocused: {
    borderColor: colors.brand,
    borderWidth: 5,
  },
});
