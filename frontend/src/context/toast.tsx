import { Ionicons } from "@expo/vector-icons";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "@/src/theme";

type Tone = "success" | "error" | "info";
type ToastState = { message: string; tone: Tone } | null;
type ToastApi = { show: (message: string, tone?: Tone) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (message: string, tone: Tone = "info") => {
      setToast({ message, tone });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
      }, 2600);
    },
    [opacity],
  );

  const icon = toast?.tone === "success" ? "checkmark-circle" : toast?.tone === "error" ? "alert-circle" : "information-circle";
  const color = toast?.tone === "success" ? COLORS.moss : toast?.tone === "error" ? COLORS.red : COLORS.navy;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View testID="app-toast" pointerEvents="none" style={[styles.wrap, { top: insets.top + 10, opacity }]}>
          <View style={[styles.toast, { borderLeftColor: color }]}>
            <Ionicons name={icon} size={20} color={color} />
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 999 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    maxWidth: 460,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  text: { flex: 1, color: COLORS.ink, fontSize: 14, fontWeight: "600" },
});
