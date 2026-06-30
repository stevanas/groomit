import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { usePremium } from "@/src/premium";
import { ThemeColors } from "@/src/theme";
import { useThemedStyles } from "@/src/theme-context";

// Lazily/defensively load the native ads module so Expo Go (no native module) never crashes.
let Ads: any = null;
try {
  Ads = require("react-native-google-mobile-ads");
} catch {
  Ads = null;
}

// Use Google's official test unit during development AND while testing pre-release builds.
// Set USE_TEST_ADS = false only for the public release so real ads serve (never tap your own live ads).
const USE_TEST_ADS = true;
const REAL_BANNER_UNIT_ID = "ca-app-pub-9770198187060268/9816758769";
const BANNER_UNIT_ID = Ads && (USE_TEST_ADS || __DEV__) ? Ads.TestIds.ADAPTIVE_BANNER : REAL_BANNER_UNIT_ID;

let initialized = false;

export default function AdBanner() {
  const { isPremium, loading } = usePremium();
  const [failed, setFailed] = useState(false);
  const styles = useThemedStyles(makeStyles);

  useEffect(() => {
    if (Ads && !initialized) {
      initialized = true;
      Ads.default?.().initialize?.().catch(() => {});
    }
  }, []);

  if (!Ads || loading || isPremium || failed) return null;

  const { BannerAd, BannerAdSize } = Ads;

  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={BANNER_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: 4, backgroundColor: colors.surface },
});
