import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { COLORS, ROLE_LABEL } from "@/src/theme";

const DEMO = [
  { role: "admin", username: "admin", password: "Admin@123456" },
  { role: "reviewer", username: "reviewer", password: "Review@123456" },
  { role: "lecturer", username: "lecturer", password: "Lecture@12345" },
  { role: "office", username: "office", password: "Office@123456" },
];

export default function Login() {
  const { signIn } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (u = username, p = password) => {
    if (!u || !p) return toast.show("Enter your username and password", "error");
    setBusy(true);
    try {
      await signIn(u, p);
    } catch (e: any) {
      toast.show(e.message || "Login failed", "error");
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.brandMark}>
            <Ionicons name="school" size={26} color={COLORS.surface} />
          </View>
          <Text style={s.eyebrow}>REGISTRAR DESK · 2026–27</Text>
          <Text style={s.brand}>Admissions</Text>
          <Text style={s.sub}>Secure staff access. Sign in to manage applications, documents and admissions.</Text>

          <View style={s.field}>
            <Text style={s.label}>USERNAME OR EMAIL</Text>
            <TextInput
              testID="login-username-input"
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. admin"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={s.input}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>PASSWORD</Text>
            <View style={s.passwordRow}>
              <TextInput
                testID="login-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.muted}
                secureTextEntry={!show}
                autoCapitalize="none"
                style={[s.input, { flex: 1, borderWidth: 0 }]}
              />
              <Pressable testID="toggle-password-button" onPress={() => setShow(!show)} style={s.eye}>
                <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.muted} />
              </Pressable>
            </View>
          </View>

          <Pressable testID="login-submit-button" onPress={() => submit()} disabled={busy} style={[s.button, busy && { opacity: 0.7 }]}>
            <Text style={s.buttonText}>{busy ? "Signing in…" : "Sign in"}</Text>
            {!busy && <Ionicons name="arrow-forward" size={18} color={COLORS.surface} />}
          </Pressable>

          <Text style={s.demoTitle}>DEMO ACCOUNTS · TAP TO SIGN IN</Text>
          <View style={s.demoGrid}>
            {DEMO.map((d) => (
              <Pressable
                key={d.role}
                testID={`demo-login-${d.role}`}
                onPress={() => {
                  setUsername(d.username);
                  setPassword(d.password);
                  submit(d.username, d.password);
                }}
                style={s.demoCard}
              >
                <Text style={s.demoRole}>{ROLE_LABEL[d.role]}</Text>
                <Text style={s.demoUser}>{d.username}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 26, paddingTop: 40, paddingBottom: 40 },
  brandMark: { width: 56, height: 56, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: COLORS.muted, fontWeight: "700" },
  brand: { fontSize: 40, lineHeight: 44, color: COLORS.ink, fontWeight: "800", letterSpacing: -1.2 },
  sub: { color: COLORS.muted, fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 12 },
  field: { marginTop: 20 },
  label: { color: COLORS.muted, fontSize: 11, letterSpacing: 1.2, fontWeight: "800", marginBottom: 8 },
  input: { height: 52, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface, paddingHorizontal: 14, color: COLORS.ink, fontSize: 15 },
  passwordRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface },
  eye: { width: 48, height: 52, alignItems: "center", justifyContent: "center" },
  button: { marginTop: 28, height: 54, backgroundColor: COLORS.red, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: COLORS.surface, fontWeight: "800", fontSize: 16 },
  demoTitle: { color: COLORS.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: "800", marginTop: 36, marginBottom: 12 },
  demoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  demoCard: { width: "47%", flexGrow: 1, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface, padding: 14 },
  demoRole: { color: COLORS.ink, fontWeight: "800", fontSize: 14 },
  demoUser: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
});
