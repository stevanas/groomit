// Web stub for the IAP service — purchases are not available on web.
export const REMOVE_ADS_PRODUCT_ID = "remove_ads_lifetime";

export async function initIap(): Promise<boolean> {
  return false;
}
export async function isRemoveAdsOwned(): Promise<boolean> {
  return false;
}
export async function buyRemoveAds(): Promise<void> {
  throw new Error("unavailable");
}
export async function restore(): Promise<boolean> {
  return false;
}
export function onPurchaseUpdated(_cb: (productId: string) => void): () => void {
  return () => {};
}
export function isIapAvailable(): boolean {
  return false;
}
export async function getRemoveAdsPrice(): Promise<string | null> {
  return null;
}
