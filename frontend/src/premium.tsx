import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import * as iap from "@/src/iap";

const KEY = "premium_remove_ads";

type PremiumCtx = {
  isPremium: boolean;
  loading: boolean;
  available: boolean; // whether real purchases are possible in this runtime
  setPremium: (v: boolean) => Promise<void>;
  buy: () => Promise<void>;
  restore: () => Promise<boolean>;
};

const Context = createContext<PremiumCtx>({
  isPremium: false,
  loading: true,
  available: false,
  setPremium: async () => {},
  buy: async () => {},
  restore: async () => false,
});

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const available = iap.isIapAvailable();

  const setPremium = useCallback(async (v: boolean) => {
    setIsPremium(v);
    await storage.setItem(KEY, v ? "1" : "0");
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await storage.getItem<string>(KEY, "0");
      if (mounted && stored === "1") setIsPremium(true);
      setLoading(false);

      // Reconcile with the store (covers reinstalls / cross-device on same account).
      const owned = await iap.isRemoveAdsOwned();
      if (mounted && owned) await setPremium(true);
    })();

    const unsub = iap.onPurchaseUpdated((productId) => {
      if (productId === iap.REMOVE_ADS_PRODUCT_ID) setPremium(true);
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [setPremium]);

  const buy = useCallback(async () => {
    await iap.buyRemoveAds();
    // Success is also handled by the purchase listener; optimistic check after.
    const owned = await iap.isRemoveAdsOwned();
    if (owned) await setPremium(true);
  }, [setPremium]);

  const restore = useCallback(async () => {
    const owned = await iap.restore();
    if (owned) await setPremium(true);
    return owned;
  }, [setPremium]);

  return (
    <Context.Provider value={{ isPremium, loading, available, setPremium, buy, restore }}>
      {children}
    </Context.Provider>
  );
}

export const usePremium = () => useContext(Context);
