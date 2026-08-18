import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ApplicantRow, EmptyState, Metric, SectionTitle } from "@/src/components/common";
import { ApplicantDetailModal, NewApplicantModal } from "@/src/components/modals";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { COLORS, ROLE_LABEL } from "@/src/theme";
import { Applicant, Course, Dashboard } from "@/src/types";

export default function Overview() {
  const { user, signOut, can } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<Dashboard | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<Applicant | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [d, cs] = await Promise.all([api.get("/dashboard"), api.get("/courses")]);
      setData(d);
      setCourses(cs);
    } catch (e: any) {
      toast.show(e.message || "Could not load dashboard", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const canCreate = can("admin", "office");

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>REGISTRAR DESK · 2026–27</Text>
          <Text style={s.brand}>Admissions</Text>
        </View>
        <Pressable testID="signout-button" style={s.iconButton} onPress={signOut}>
          <Ionicons name="log-out-outline" size={21} color={COLORS.ink} />
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.red} />
        </View>
      ) : (
        <ScrollView testID="overview-scroll" contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.red} />}>
          <View style={s.userStrip}>
            <View style={s.userAvatar}>
              <Text style={s.userAvatarText}>{user?.username?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.userName}>{user?.username}</Text>
              <Text style={s.userRole}>{ROLE_LABEL[user?.role || "office"]}</Text>
            </View>
          </View>

          {data && (
            <>
              <View style={s.hero}>
                <View style={{ flex: 1 }}>
                  <Text style={s.eyebrow}>TODAY’S QUEUE</Text>
                  <Text style={s.heroTitle}>A clear next step for every applicant.</Text>
                </View>
                <View style={s.heroMark}>
                  <Text style={s.heroMarkText}>{String(data.under_review).padStart(2, "0")}</Text>
                  <Text style={s.heroMarkLabel}>IN REVIEW</Text>
                </View>
              </View>

              <View style={s.metrics}>
                <Metric label="Applications" value={data.total} testID="metric-total" />
                <Metric label="Admitted" value={data.admitted} tone={COLORS.moss} testID="metric-admitted" />
                <Metric label="Docs pending" value={data.documents_pending} tone={COLORS.ochre} testID="metric-docs" />
                <Metric label="Collected" value={`₹${(data.fees_collected / 1000).toFixed(0)}k`} tone={COLORS.navy} testID="metric-fees" />
              </View>

              <SectionTitle title="Needs attention" />
              <View style={s.alert}>
                <View style={s.alertDot}>
                  <Ionicons name="warning-outline" size={18} color={COLORS.ochre} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.alertTitle}>{data.alerts[0]?.title}</Text>
                  <Text style={s.body}>{data.alerts[0]?.detail}</Text>
                </View>
              </View>

              <SectionTitle title="Recent applications" />
              {data.recent.map((a) => (
                <ApplicantRow key={a.application_no} applicant={a} onPress={() => setSelected(a)} />
              ))}
              {data.recent.length === 0 && <EmptyState title="No applications yet" detail="New applications will appear here." />}
            </>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {canCreate && (
        <Pressable testID="new-applicant-fab" style={s.fab} onPress={() => setShowNew(true)}>
          <Ionicons name="add" size={22} color={COLORS.surface} />
          <Text style={s.fabText}>New</Text>
        </Pressable>
      )}

      <ApplicantDetailModal
        applicant={selected}
        courses={courses}
        onClose={() => setSelected(null)}
        onChanged={(a) => {
          setSelected(a);
          load();
        }}
        onDeleted={() => {
          setSelected(null);
          load();
        }}
      />
      <NewApplicantModal
        visible={showNew}
        courses={courses}
        onClose={() => setShowNew(false)}
        onSaved={() => {
          setShowNew(false);
          load();
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.paper },
  header: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: COLORS.muted, fontWeight: "700" },
  brand: { fontSize: 32, lineHeight: 36, color: COLORS.ink, fontWeight: "800", letterSpacing: -1 },
  iconButton: { width: 44, height: 44, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 22, paddingTop: 8 },
  userStrip: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface, padding: 12, marginBottom: 20 },
  userAvatar: { width: 40, height: 40, backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center" },
  userAvatarText: { color: COLORS.surface, fontWeight: "800", fontSize: 16 },
  userName: { color: COLORS.ink, fontWeight: "800", fontSize: 15, textTransform: "capitalize" },
  userRole: { color: COLORS.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  hero: { flexDirection: "row", backgroundColor: COLORS.navy, padding: 20, minHeight: 150, alignItems: "flex-end" },
  heroTitle: { color: COLORS.surface, fontSize: 24, lineHeight: 28, fontWeight: "800", marginTop: 10, maxWidth: 235 },
  heroMark: { borderLeftWidth: 1, borderLeftColor: "#8491A0", paddingLeft: 16, alignItems: "flex-end" },
  heroMarkText: { color: COLORS.surface, fontSize: 38, fontWeight: "800" },
  heroMarkLabel: { color: "#C9D0D6", fontSize: 10, letterSpacing: 1.2, fontWeight: "700" },
  metrics: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, borderTopWidth: 1, borderLeftWidth: 1, borderColor: COLORS.line },
  alert: { padding: 14, backgroundColor: "#FFF5E4", borderWidth: 1, borderColor: "#E8C98C", flexDirection: "row", alignItems: "center", gap: 12 },
  alertDot: { width: 34, height: 34, backgroundColor: "#FDE8BF", alignItems: "center", justifyContent: "center" },
  alertTitle: { color: COLORS.ink, fontWeight: "800", marginBottom: 3 },
  body: { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  fab: { position: "absolute", right: 20, bottom: 20, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.red, paddingHorizontal: 18, height: 50, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  fabText: { color: COLORS.surface, fontWeight: "800", fontSize: 15 },
});
