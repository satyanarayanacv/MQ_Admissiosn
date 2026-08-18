import { ActivityIndicator, View } from "react-native";

import { COLORS } from "@/src/theme";

// Splash route — AuthGate in _layout redirects to /login or /(app).
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.paper }}>
      <ActivityIndicator color={COLORS.red} />
    </View>
  );
}
