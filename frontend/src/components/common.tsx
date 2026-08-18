import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { COLORS, stageColor } from "@/src/theme";
import { Applicant } from "@/src/types";

export function Status({ stage }: { stage: string }) {
  const color = stageColor(stage);
  return (
    <View style={[c.status, { borderColor: color }]}>
      <View style={[c.statusDot, { backgroundColor: color }]} />
      <Text style={[c.statusText, { color }]}>{stage}</Text>
    </View>
  );
}

export function Metric({ label, value, tone = COLORS.red, testID }: { label: string; value: number | string; tone?: string; testID?: string }) {
  return (
    <View style={c.metric} testID={testID}>
      <Text style={c.metricLabel}>{label}</Text>
      <Text style={[c.metricValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={c.sectionTitle}>
      <Text style={c.sectionHeading}>{title}</Text>
      {action && onPress && (
        <Pressable testID={`${action.toLowerCase().replace(/ /g, "-")}-button`} onPress={onPress}>
          <Text style={c.link}>
            {action} <Ionicons name="arrow-forward" size={13} />
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function ApplicantRow({ applicant, onPress }: { applicant: Applicant; onPress: () => void }) {
  return (
    <Pressable testID={`applicant-${applicant.application_no}`} onPress={onPress} style={({ pressed }) => [c.row, pressed && { opacity: 0.7 }]}>
      <View style={c.avatar}>
        <Text style={c.avatarText}>
          {applicant.first_name[0]}
          {applicant.last_name?.[0] || ""}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={c.rowTop}>
          <Text style={c.name} numberOfLines={1}>
            {applicant.first_name} {applicant.last_name}
          </Text>
          <Text style={c.mono}>{applicant.application_no}</Text>
        </View>
        <Text style={c.course} numberOfLines={1}>
          {applicant.course || "Course not set"}
        </Text>
        <View style={c.rowBottom}>
          <Status stage={applicant.stage} />
          <Text style={c.meta}>
            {applicant.quota}
            {applicant.phase ? ` · P${applicant.phase}` : ""}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, testID }: { label: string; value: string; onChangeText: (x: string) => void; placeholder?: string; keyboardType?: "default" | "email-address" | "numeric" | "phone-pad"; testID?: string }) {
  return (
    <View style={c.field}>
      <Text style={c.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        style={c.input}
      />
    </View>
  );
}

export function PrimaryButton({ label, onPress, loading, icon = "checkmark", testID }: { label: string; onPress: () => void; loading?: boolean; icon?: keyof typeof Ionicons.glyphMap; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={loading} style={c.primaryButton}>
      {loading ? (
        <ActivityIndicator color={COLORS.surface} />
      ) : (
        <>
          <Ionicons name={icon} size={19} color={COLORS.surface} />
          <Text style={c.primaryText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function EmptyState({ title, detail, icon = "file-tray-outline" }: { title: string; detail: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={c.empty}>
      <Ionicons name={icon} size={30} color={COLORS.muted} />
      <Text style={c.emptyTitle}>{title}</Text>
      <Text style={c.body}>{detail}</Text>
    </View>
  );
}

export const c = StyleSheet.create({
  status: { borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 6, height: 6 },
  statusText: { fontSize: 11, fontWeight: "800" },
  metric: { width: "50%", padding: 14, borderRightWidth: 1, borderBottomWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface },
  metricLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  metricValue: { fontSize: 26, fontWeight: "800", marginTop: 5 },
  sectionTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 30, marginBottom: 12 },
  sectionHeading: { fontSize: 19, fontWeight: "800", color: COLORS.ink },
  link: { color: COLORS.red, fontSize: 13, fontWeight: "800" },
  row: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.line, minHeight: 76 },
  avatar: { width: 42, height: 42, backgroundColor: "#E9E3D7", alignItems: "center", justifyContent: "center" },
  avatarText: { color: COLORS.navy, fontWeight: "800" },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 5 },
  name: { color: COLORS.ink, fontWeight: "800", fontSize: 15, flexShrink: 1 },
  mono: { color: COLORS.muted, fontSize: 10, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  course: { color: COLORS.muted, fontSize: 13, marginTop: 4 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  meta: { color: COLORS.muted, fontSize: 11, fontWeight: "700" },
  body: { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  field: { marginTop: 18 },
  label: { color: COLORS.muted, fontSize: 11, letterSpacing: 1.2, fontWeight: "800", marginBottom: 8 },
  input: { height: 50, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface, paddingHorizontal: 14, color: COLORS.ink, fontSize: 15 },
  primaryButton: { marginTop: 28, height: 52, backgroundColor: COLORS.red, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: COLORS.surface, fontWeight: "800", fontSize: 15 },
  empty: { alignItems: "center", padding: 40, gap: 10 },
  emptyTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 17 },
});
