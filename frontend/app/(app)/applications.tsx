import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ApplicantRow, EmptyState } from "@/src/components/common";
import { ApplicantDetailModal, NewApplicantModal } from "@/src/components/modals";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { COLORS } from "@/src/theme";
import { Applicant, Course } from "@/src/types";

const STAGES = ["", "New", "Documents", "Under review", "Admitted"];

export default function Applications() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<Applicant[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Applicant | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, cs] = await Promise.all([
        api.get(`/applicants?q=${encodeURIComponent(query)}&stage=${encodeURIComponent(filter)}`),
        api.get("/courses"),
      ]);
      setRows(a);
      setCourses(cs);
    } catch (e: any) {
      toast.show(e.message || "Could not load applications", "error");
    } finally {
      setLoading(false);
    }
  }, [query, filter, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const canCreate = can("admin", "office");

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.head}>
        <Text style={s.pageTitle}>Application queue</Text>
        <View style={s.search}>
          <Ionicons name="search" size={18} color={COLORS.muted} />
          <TextInput
            testID="application-search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Name, application or course"
            placeholderTextColor={COLORS.muted}
            style={s.searchInput}
          />
          {query.length > 0 && (
            <Pressable testID="clear-search-button" onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={COLORS.muted} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow} style={s.filterScroll}>
          {STAGES.map((x) => (
            <Pressable
              testID={`filter-${(x || "all").toLowerCase().replace(/ /g, "-")}`}
              key={x || "all"}
              onPress={() => setFilter(x)}
              style={[s.chip, filter === x && s.chipActive]}
            >
              <Text style={[s.chipText, filter === x && s.chipTextActive]}>{x || "All stages"}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.red} />
        </View>
      ) : (
        <FlatList
          testID="applications-list"
          data={rows}
          keyExtractor={(a) => a.application_no}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => <ApplicantRow applicant={item} onPress={() => setSelected(item)} />}
          ListEmptyComponent={<EmptyState title="No applications found" detail="Try a different search or stage." />}
        />
      )}

      {canCreate && (
        <Pressable testID="new-applicant-fab" style={s.fab} onPress={() => setShowNew(true)}>
          <Ionicons name="add" size={22} color={COLORS.surface} />
          <Text style={s.fabText}>New</Text>
        </Pressable>
      )}

      <ApplicantDetailModal
        applicant={selected}
        onClose={() => setSelected(null)}
        onChanged={(a) => {
          setSelected(a);
          setRows((prev) => prev.map((r) => (r.application_no === a.application_no ? a : r)));
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
  head: { paddingHorizontal: 22, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line, backgroundColor: COLORS.paper },
  pageTitle: { color: COLORS.ink, fontSize: 26, fontWeight: "800" },
  search: { marginTop: 14, height: 50, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  searchInput: { flex: 1, marginLeft: 6, color: COLORS.ink, fontSize: 15 },
  filterScroll: { marginTop: 12, marginBottom: 12, maxHeight: 56 },
  filterRow: { gap: 8, paddingRight: 22 },
  chip: { flexShrink: 0, height: 36, justifyContent: "center", borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14, backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  chipText: { color: COLORS.muted, fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: COLORS.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 90 },
  fab: { position: "absolute", right: 20, bottom: 20, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.red, paddingHorizontal: 18, height: 50, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  fabText: { color: COLORS.surface, fontWeight: "800", fontSize: 15 },
});
