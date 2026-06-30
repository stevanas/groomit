import { Redirect } from "expo-router";

// Login flow is temporarily bypassed — open straight to the main app.
// Auth code is preserved in src/auth.tsx and app/login.tsx for later use.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
