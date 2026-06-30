// Native in-app purchase service (expo-iap). Single non-consumable "remove ads / support".
// All calls are guarded so the app never crashes in Expo Go (where the native module is absent).

export const REMOVE_ADS_PRODUCT_ID = "remove_ads_lifetime";

function getMod(): any {
  // Static require so Metro bundles it; throws in Expo Go -> caught by callers.
  return require("expo-iap");
}

let connected = false;

export async function initIap(): Promise<boolean> {
  try {
    const m = getMod();
    if (!connected) {
      await m.initConnection();
      connected = true;
    }
    return true;
  } catch {
    return false;
  }
}

export async function isRemoveAdsOwned(): Promise<boolean> {
  try {
    const m = getMod();
    await initIap();
    const purchases = await m.getAvailablePurchases();
    return (purchases || []).some((p: any) => p.productId === REMOVE_ADS_PRODUCT_ID);
  } catch {
    return false;
  }
}

export async function buyRemoveAds(): Promise<void> {
  const m = getMod();
  await initIap();
  await m.requestPurchase({
    request: {
      apple: { sku: REMOVE_ADS_PRODUCT_ID },
      google: { skus: [REMOVE_ADS_PRODUCT_ID] },
    },
    type: "in-app",
  });
}

export async function restore(): Promise<boolean> {
  try {
    const m = getMod();
    await initIap();
    await m.restorePurchases();
    return await isRemoveAdsOwned();
  } catch {
    return false;
  }
}

// Subscribe to successful purchases; finalizes the transaction and reports the productId.
export function onPurchaseUpdated(cb: (productId: string) => void): () => void {
  try {
    const m = getMod();
    const sub = m.purchaseUpdatedListener(async (purchase: any) => {
      try {
        await m.finishTransaction({ purchase, isConsumable: false });
      } catch {
        /* ignore */
      }
      cb(purchase?.productId);
    });
    return () => sub?.remove?.();
  } catch {
    return () => {};
  }
}

// Whether real purchases are possible in this runtime (native build with the module present).
export function isIapAvailable(): boolean {
  try {
    getMod();
    return true;
  } catch {
    return false;
  }
}
