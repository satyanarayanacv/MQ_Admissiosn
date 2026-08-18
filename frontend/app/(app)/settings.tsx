import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { EmptyState, Field, PrimaryButton, SectionTitle } from "@/src/components/common";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { COLORS, ROLE_COLOR, ROLE_LABEL } from "@/src/theme";
import { Course, Role, User } from "@/src/types";

export default function Settings() {
  const { user, signOut, can } = useAuth();
  const toast = useToast();
  const isAdmin = can("admin");
  const [courses, setCourses] = useState<Course[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCourse, setShowCourse] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [showStaff, setShowStaff] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Promise<any>[] = [api.get("/courses")];
      if (isAdmin) tasks.push(api.get("/staff"));
      const [cs, st] = await Promise.all(tasks);
      setCourses(cs);
      if (isAdmin) setStaff(st);
    } catch (e: any) {
      toast.show(e.message || "Could not load settings", "error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const removeCourse = async (code: string) => {
    try {
      await api.del(`/courses/${code}`);
      toast.show("Course removed", "success");
      load();
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  const removeStaff = async (username: string) => {
    try {
      await api.del(`/staff/${username}`);
      toast.show("Staff member removed", "success");
      load();
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.pageTitle}>Settings</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.red} />
        </View>
      ) : (
        <ScrollView testID="settings-scroll" contentContainerStyle={s.content}>
          <View style={s.profile}>
            <View style={[s.pAvatar, { backgroundColor: ROLE_COLOR[user?.role || "office"] }]}>
              <Text style={s.pAvatarText}>{user?.username?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.pName}>{user?.username}</Text>
              <Text style={s.pEmail}>{user?.email}</Text>
              <View style={[s.roleTag, { borderColor: ROLE_COLOR[user?.role || "office"] }]}>
                <Text style={[s.roleTagText, { color: ROLE_COLOR[user?.role || "office"] }]}>{ROLE_LABEL[user?.role || "office"]}</Text>
              </View>
            </View>
          </View>

          <SectionTitle title="Courses" action={isAdmin ? "Add course" : undefined} onPress={isAdmin ? () => { setEditCourse(null); setShowCourse(true); } : undefined} />
          {courses.length === 0 && <EmptyState title="No courses yet" detail={isAdmin ? "Add your first course to start." : "Courses will appear here."} icon="library-outline" />}
          {courses.map((cx) => (
            <View key={cx.code} style={s.item} testID={`course-item-${cx.code}`}>
              <View style={s.itemBadge}>
                <Text style={s.itemBadgeText}>{cx.code}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle} numberOfLines={1}>
                  {cx.name}
                </Text>
                <Text style={s.itemSub}>
                  {cx.department || "—"} · {cx.seats} seats · ₹{cx.fee.toLocaleString("en-IN")}
                </Text>
              </View>
              {isAdmin && (
                <View style={s.itemActions}>
                  <Pressable testID={`edit-course-${cx.code}`} onPress={() => { setEditCourse(cx); setShowCourse(true); }} style={s.smallBtn}>
                    <Ionicons name="create-outline" size={18} color={COLORS.navy} />
                  </Pressable>
                  <Pressable testID={`delete-course-${cx.code}`} onPress={() => removeCourse(cx.code)} style={s.smallBtn}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                  </Pressable>
                </View>
              )}
            </View>
          ))}

          {isAdmin && (
            <>
              <SectionTitle title="Staff access" action="Add staff" onPress={() => setShowStaff(true)} />
              {staff.map((u) => (
                <View key={u.id} style={s.item} testID={`staff-item-${u.username}`}>
                  <View style={[s.itemBadge, { backgroundColor: ROLE_COLOR[u.role] }]}>
                    <Text style={[s.itemBadgeText, { color: COLORS.surface }]}>{u.username[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemTitle}>{u.username}</Text>
                    <Text style={s.itemSub}>
                      {u.email} · {ROLE_LABEL[u.role]}
                    </Text>
                  </View>
                  {u.username !== user?.username && (
                    <Pressable testID={`delete-staff-${u.username}`} onPress={() => removeStaff(u.username)} style={s.smallBtn}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                    </Pressable>
                  )}
                </View>
              ))}
            </>
          )}

          <Pressable testID="settings-signout-button" style={s.signOut} onPress={signOut}>
            <Ionicons name="log-out-outline" size={19} color={COLORS.red} />
            <Text style={s.signOutText}>Sign out</Text>
          </Pressable>
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      <CourseModal
        visible={showCourse}
        course={editCourse}
        onClose={() => setShowCourse(false)}
        onSaved={() => {
          setShowCourse(false);
          load();
        }}
      />
      <StaffModal
        visible={showStaff}
        onClose={() => setShowStaff(false)}
        onSaved={() => {
          setShowStaff(false);
          load();
        }}
      />
    </SafeAreaView>
  );
}

function CourseModal({ visible, course, onClose, onSaved }: { visible: boolean; course: Course | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ code: "", name: "", department: "", seats: "60", fee: "0" });
  const [saving, setSaving] = useState(false);

  // Sync form when opening for edit vs create.
  const key = `${visible}-${course?.code || "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (key !== lastKey) {
    setLastKey(key);
    setForm(
      course
        ? { code: course.code, name: course.name, department: course.department, seats: String(course.seats), fee: String(course.fee) }
        : { code: "", name: "", department: "", seats: "60", fee: "0" },
    );
  }

  const save = async () => {
    if (!form.code || !form.name) return toast.show("Course code and name are required", "error");
    setSaving(true);
    try {
      const body = { code: form.code, name: form.name, department: form.department, seats: Number(form.seats) || 0, fee: Number(form.fee) || 0 };
      if (course) await api.patch(`/courses/${course.code}`, { name: body.name, department: body.department, seats: body.seats, fee: body.fee });
      else await api.post("/courses", body);
      toast.show(course ? "Course updated" : "Course added", "success");
      onSaved();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.modal} edges={["top", "bottom"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={s.modalHeader}>
            <Pressable testID="close-course-button" onPress={onClose} style={s.iconButton}>
              <Ionicons name="close" size={22} color={COLORS.ink} />
            </Pressable>
            <Text style={s.modalOverline}>{course ? "EDIT COURSE" : "NEW COURSE"}</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
            {!course && <Field label="Course code" value={form.code} onChangeText={(x) => setForm({ ...form, code: x })} placeholder="e.g. BTCS" testID="course-code-input" />}
            <Field label="Course name" value={form.name} onChangeText={(x) => setForm({ ...form, name: x })} testID="course-name-input" />
            <Field label="Department" value={form.department} onChangeText={(x) => setForm({ ...form, department: x })} testID="course-dept-input" />
            <Field label="Seats" value={form.seats} onChangeText={(x) => setForm({ ...form, seats: x })} keyboardType="numeric" testID="course-seats-input" />
            <Field label="Fee (₹)" value={form.fee} onChangeText={(x) => setForm({ ...form, fee: x })} keyboardType="numeric" testID="course-fee-input" />
            <PrimaryButton label={course ? "Save changes" : "Add course"} onPress={save} loading={saving} testID="save-course-button" />
            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function StaffModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "office" as Role });
  const [saving, setSaving] = useState(false);

  const key = String(visible);
  const [lastKey, setLastKey] = useState("");
  if (key !== lastKey) {
    setLastKey(key);
    if (visible) setForm({ username: "", email: "", password: "", role: "office" });
  }

  const save = async () => {
    if (!form.username || !form.email || !form.password) return toast.show("All fields are required", "error");
    if (form.password.length < 6) return toast.show("Password must be at least 6 characters", "error");
    setSaving(true);
    try {
      await api.post("/staff", form);
      toast.show("Staff member added", "success");
      onSaved();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.modal} edges={["top", "bottom"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={s.modalHeader}>
            <Pressable testID="close-staff-button" onPress={onClose} style={s.iconButton}>
              <Ionicons name="close" size={22} color={COLORS.ink} />
            </Pressable>
            <Text style={s.modalOverline}>NEW STAFF</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
            <Field label="Username" value={form.username} onChangeText={(x) => setForm({ ...form, username: x })} testID="staff-username-input" />
            <Field label="Email" value={form.email} onChangeText={(x) => setForm({ ...form, email: x })} keyboardType="email-address" testID="staff-email-input" />
            <Field label="Temporary password" value={form.password} onChangeText={(x) => setForm({ ...form, password: x })} testID="staff-password-input" />
            <Text style={s.roleLabel}>ROLE</Text>
            <View style={s.roleRow}>
              {(["admin", "reviewer", "lecturer", "office"] as Role[]).map((r) => (
                <Pressable testID={`role-${r}`} key={r} onPress={() => setForm({ ...form, role: r })} style={[s.roleChip, form.role === r && s.roleChipActive]}>
                  <Text style={[s.roleChipText, form.role === r && s.roleChipTextActive]}>{ROLE_LABEL[r]}</Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton label="Add staff member" onPress={save} loading={saving} icon="person-add" testID="save-staff-button" />
            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 6 },
  pageTitle: { color: COLORS.ink, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  content: { paddingHorizontal: 22, paddingBottom: 20 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, padding: 16, marginTop: 8 },
  pAvatar: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  pAvatarText: { color: COLORS.surface, fontWeight: "800", fontSize: 20 },
  pName: { color: COLORS.ink, fontWeight: "800", fontSize: 18, textTransform: "capitalize" },
  pEmail: { color: COLORS.muted, fontSize: 13, marginTop: 2 },
  roleTag: { alignSelf: "flex-start", borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8 },
  roleTagText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  itemBadge: { minWidth: 46, height: 40, paddingHorizontal: 6, backgroundColor: "#E9E3D7", alignItems: "center", justifyContent: "center" },
  itemBadgeText: { color: COLORS.navy, fontWeight: "800", fontSize: 12 },
  itemTitle: { color: COLORS.ink, fontWeight: "800", fontSize: 15 },
  itemSub: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  itemActions: { flexDirection: "row", gap: 4 },
  smallBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  signOut: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 30, height: 50, borderWidth: 1, borderColor: COLORS.red },
  signOutText: { color: COLORS.red, fontWeight: "800", fontSize: 15 },
  modal: { flex: 1, backgroundColor: COLORS.paper },
  modalHeader: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: COLORS.line },
  modalOverline: { color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, fontWeight: "800" },
  iconButton: { width: 44, height: 44, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
  modalContent: { padding: 22, paddingBottom: 40 },
  roleLabel: { color: COLORS.muted, fontSize: 11, letterSpacing: 1.2, fontWeight: "800", marginTop: 22, marginBottom: 10 },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: { borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.surface },
  roleChipActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  roleChipText: { color: COLORS.muted, fontWeight: "700", fontSize: 12 },
  roleChipTextActive: { color: COLORS.surface },
});
