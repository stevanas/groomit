import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { usePremium } from "@/src/premium";
import { colors } from "@/src/theme";

// Lazily/defensively load the native ads module so Expo Go (no native module) never crashes.
let Ads: any = null;
try {
  Ads = require("react-native-google-mobile-ads");
} catch {
  Ads = null;
}

// Use Google's official test unit during development; replace with your real banner unit ID for release.
const REAL_BANNER_UNIT_ID = "ca-app-pub-9770198187060268/9816758769";
const BANNER_UNIT_ID = __DEV__ && Ads ? Ads.TestIds.ADAPTIVE_BANNER : REAL_BANNER_UNIT_ID;

let initialized = false;

export default function AdBanner() {
  const { isPremium, loading } = usePremium();
  const [failed, setFailed] = useState(false);

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

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: 4, backgroundColor: colors.surface },
});
