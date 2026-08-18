import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { EmptyState, SectionTitle } from "@/src/components/common";
import { useToast } from "@/src/context/toast";
import { COLORS, stageColor } from "@/src/theme";
import { Report } from "@/src/types";

export default function Reports() {
  const toast = useToast();
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      setData(await api.get("/reports"));
    } catch (e: any) {
      toast.show(e.message || "Could not load reports", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const share = async () => {
    if (!data) return;
    try {
      await Share.share({ message: data.share_text, title: "Admissions summary" });
    } catch {
      toast.show("Could not open share sheet", "error");
    }
  };

  if (loading)
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator color={COLORS.red} />
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>ADMISSIONS INSIGHTS</Text>
          <Text style={s.pageTitle}>Reports</Text>
        </View>
        <Pressable testID="share-report-button" style={s.shareBtn} onPress={share}>
          <Ionicons name="share-outline" size={18} color={COLORS.surface} />
          <Text style={s.shareText}>Share</Text>
        </Pressable>
      </View>

      <ScrollView testID="reports-scroll" contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.red} />}>
        {!data || data.total === 0 ? (
          <EmptyState title="No data yet" detail="Reports populate as applications are added." icon="bar-chart-outline" />
        ) : (
          <>
            <View style={s.feeCard}>
              <Text style={s.feeLabel}>FEES COLLECTED</Text>
              <Text style={s.feeValue}>₹{data.fees.collected.toLocaleString("en-IN")}</Text>
              <Text style={s.feeSub}>
                of ₹{data.fees.expected.toLocaleString("en-IN")} expected · {data.fees.collection_rate}% collected
              </Text>
              <View style={s.progress}>
                <View style={[s.progressFill, { width: `${Math.min(100, data.fees.collection_rate)}%` }]} />
              </View>
              <View style={s.feeSplit}>
                <View style={s.feeSplitItem}>
                  <Text style={s.feeSplitLabel}>Outstanding</Text>
                  <Text style={[s.feeSplitValue, { color: COLORS.ochre }]}>₹{data.fees.outstanding.toLocaleString("en-IN")}</Text>
                </View>
                <View style={s.feeSplitItem}>
                  <Text style={s.feeSplitLabel}>Applications</Text>
                  <Text style={s.feeSplitValue}>{data.total}</Text>
                </View>
              </View>
            </View>

            <SectionTitle title="Pipeline by stage" />
            <View style={s.card}>
              {Object.entries(data.by_stage).map(([stage, count]) => {
                const pct = data.total ? (count / data.total) * 100 : 0;
                return (
                  <View key={stage} style={s.barRow} testID={`stage-bar-${stage.toLowerCase().replace(/ /g, "-")}`}>
                    <Text style={s.barLabel}>{stage}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${Math.max(4, pct)}%`, backgroundColor: stageColor(stage) }]} />
                    </View>
                    <Text style={s.barValue}>{count}</Text>
                  </View>
                );
              })}
            </View>

            <SectionTitle title="By course" />
            <View style={s.card}>
              <View style={[s.tRow, s.tHead]}>
                <Text style={[s.tCell, s.tHeadText, { flex: 2.2 }]}>Course</Text>
                <Text style={[s.tCell, s.tHeadText, s.tRight]}>Appl.</Text>
                <Text style={[s.tCell, s.tHeadText, s.tRight]}>Adm.</Text>
                <Text style={[s.tCell, s.tHeadText, s.tRight, { flex: 1.4 }]}>Collected</Text>
              </View>
              {data.by_course.map((r) => (
                <View key={r.course} style={s.tRow} testID={`course-row-${r.course.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  <Text style={[s.tCell, s.tName, { flex: 2.2 }]} numberOfLines={2}>
                    {r.course}
                  </Text>
                  <Text style={[s.tCell, s.tRight]}>{r.applicants}</Text>
                  <Text style={[s.tCell, s.tRight, { color: COLORS.moss, fontWeight: "800" }]}>{r.admitted}</Text>
                  <Text style={[s.tCell, s.tRight, { flex: 1.4 }]}>₹{(r.collected / 1000).toFixed(0)}k</Text>
                </View>
              ))}
            </View>

            <SectionTitle title="By quota" />
            <View style={s.quotaRow}>
              {Object.entries(data.by_quota).map(([q, count]) => (
                <View key={q} style={s.quotaCard} testID={`quota-card-${q.toLowerCase()}`}>
                  <Text style={s.quotaValue}>{count}</Text>
                  <Text style={s.quotaLabel}>{q}</Text>
                </View>
              ))}
            </View>
            <View style={{ height: 30 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: COLORS.muted, fontWeight: "700" },
  pageTitle: { color: COLORS.ink, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.navy, paddingHorizontal: 14, height: 40 },
  shareText: { color: COLORS.surface, fontWeight: "800", fontSize: 13 },
  content: { padding: 22, paddingTop: 6 },
  feeCard: { backgroundColor: COLORS.navy, padding: 20 },
  feeLabel: { color: "#C9D0D6", fontSize: 11, letterSpacing: 1.2, fontWeight: "800" },
  feeValue: { color: COLORS.surface, fontSize: 34, fontWeight: "800", marginTop: 6 },
  feeSub: { color: "#C9D0D6", fontSize: 13, marginTop: 4 },
  progress: { height: 8, backgroundColor: "#3A4C61", marginTop: 14 },
  progressFill: { height: 8, backgroundColor: COLORS.moss },
  feeSplit: { flexDirection: "row", marginTop: 16, borderTopWidth: 1, borderTopColor: "#3A4C61", paddingTop: 14 },
  feeSplitItem: { flex: 1 },
  feeSplitLabel: { color: "#C9D0D6", fontSize: 11, fontWeight: "700" },
  feeSplitValue: { color: COLORS.surface, fontSize: 18, fontWeight: "800", marginTop: 3 },
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, padding: 16 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  barLabel: { width: 92, color: COLORS.ink, fontSize: 13, fontWeight: "600" },
  barTrack: { flex: 1, height: 12, backgroundColor: COLORS.line },
  barFill: { height: 12 },
  barValue: { width: 28, textAlign: "right", color: COLORS.ink, fontWeight: "800" },
  tRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.line },
  tHead: { borderTopWidth: 0 },
  tCell: { flex: 1, color: COLORS.ink, fontSize: 13 },
  tHeadText: { color: COLORS.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  tName: { fontWeight: "700" },
  tRight: { textAlign: "right" },
  quotaRow: { flexDirection: "row", gap: 12 },
  quotaCard: { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, padding: 16, alignItems: "center" },
  quotaValue: { color: COLORS.red, fontSize: 26, fontWeight: "800" },
  quotaLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
});
