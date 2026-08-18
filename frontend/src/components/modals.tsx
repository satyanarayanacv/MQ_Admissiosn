import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Field, PrimaryButton } from "@/src/components/common";
import { api, fileUrl, uploadDocument } from "@/src/api";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { COLORS } from "@/src/theme";
import { Applicant } from "@/src/types";

const STAGES = ["New", "Documents", "Under review", "Admitted"];

export function ApplicantDetailModal({ applicant, courses, onClose, onChanged, onDeleted }: { applicant: Applicant | null; courses?: { name: string; fee: number }[]; onClose: () => void; onChanged: (a: Applicant) => void; onDeleted?: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [payAmount, setPayAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canStage = can("admin", "reviewer", "lecturer");
  const canDoc = can("admin", "reviewer", "lecturer", "office");
  const canPay = can("admin", "office");
  const canEdit = can("admin", "office");
  const canDelete = can("admin");

  if (!applicant) return null;
  const docs = Object.entries(applicant.documents);
  const docFiles = (applicant as any).document_files || {};

  const updateStage = async (stage: string) => {
    if (!canStage) return toast.show("Your role can't change the review stage", "error");
    try {
      const item = await api.patch(`/applicants/${applicant.application_no}/stage`, { stage });
      onChanged(item);
      toast.show(`Moved to ${stage}`, "success");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  const updateDoc = async (document: string, received: boolean) => {
    if (!canDoc) return toast.show("Your role can't update documents", "error");
    try {
      const item = await api.patch(`/applicants/${applicant.application_no}/documents`, { document, received });
      onChanged(item);
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  const pickAndUpload = async (document: string) => {
    if (!canDoc) return toast.show("Your role can't upload documents", "error");
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setUploadingDoc(document);
      const item = await uploadDocument(applicant.application_no, document, { uri: asset.uri, name: asset.name || `${document}.pdf`, type: asset.mimeType || "application/octet-stream" });
      onChanged(item);
      toast.show(`${document} uploaded`, "success");
    } catch (e: any) {
      toast.show(e.message || "Upload failed", "error");
    } finally {
      setUploadingDoc(null);
    }
  };

  const viewFile = async (document: string) => {
    try {
      const url = await fileUrl(applicant.application_no, document);
      await Linking.openURL(url);
    } catch {
      toast.show("Could not open the file", "error");
    }
  };

  const addPayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return toast.show("Enter a valid amount", "error");
    setBusy(true);
    try {
      const item = await api.post(`/applicants/${applicant.application_no}/payments`, { amount, mode: "UPI" });
      onChanged(item);
      setPayAmount("");
      toast.show(`Payment of ₹${amount.toLocaleString("en-IN")} recorded`, "success");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const removeApplicant = async () => {
    try {
      await api.del(`/applicants/${applicant.application_no}`);
      toast.show("Applicant removed", "success");
      setConfirmDelete(false);
      onDeleted?.();
      onClose();
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  const remaining = Math.max(0, applicant.total_fee - applicant.paid);

  return (
    <Modal visible={!!applicant} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.modal} edges={["top", "bottom"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={s.modalHeader}>
            <Pressable testID="close-detail-button" onPress={onClose} style={s.iconButton}>
              <Ionicons name="close" size={22} color={COLORS.ink} />
            </Pressable>
            <Text style={s.modalOverline}>APPLICATION DETAIL</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {canEdit && (
                <Pressable testID="edit-applicant-button" onPress={() => setEditing(true)} style={s.iconButton}>
                  <Ionicons name="create-outline" size={20} color={COLORS.navy} />
                </Pressable>
              )}
              {canDelete && (
                <Pressable testID="delete-applicant-button" onPress={() => setConfirmDelete(true)} style={s.iconButton}>
                  <Ionicons name="trash-outline" size={20} color={COLORS.red} />
                </Pressable>
              )}
            </View>
          </View>
          <ScrollView contentContainerStyle={s.detailContent} keyboardShouldPersistTaps="handled">
            <View style={s.detailIdentity}>
              <View style={s.avatarLarge}>
                <Text style={s.avatarLargeText}>
                  {applicant.first_name[0]}
                  {applicant.last_name?.[0] || ""}
                </Text>
              </View>
              <Text style={s.detailName}>
                {applicant.first_name} {applicant.last_name}
              </Text>
              <Text style={s.body}>
                {applicant.application_no} · {applicant.course || "Course not set"}
              </Text>
              {!!(applicant.mobile || applicant.email) && (
                <Text style={s.body}>
                  {[applicant.mobile, applicant.email].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>

            <Text style={s.label}>REVIEW STAGE</Text>
            <View style={s.stageRow}>
              {STAGES.map((x) => (
                <Pressable
                  testID={`stage-${x.toLowerCase().replace(/ /g, "-")}`}
                  key={x}
                  onPress={() => updateStage(x)}
                  style={[s.stagePill, applicant.stage === x && s.stagePillActive]}
                >
                  <Text style={[s.stagePillText, applicant.stage === x && s.stagePillTextActive]}>{x}</Text>
                </Pressable>
              ))}
            </View>

            <View style={s.detailCard}>
              <Text style={s.cardTitle}>Document checklist</Text>
              {docs.map(([name, done]) => {
                const hasFile = !!docFiles[name];
                return (
                  <View key={name} style={s.docRow}>
                    <Pressable testID={`document-${name.toLowerCase().replace(/ /g, "-")}`} onPress={() => updateDoc(name, !done)} style={s.docToggle}>
                      <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={22} color={done ? COLORS.moss : COLORS.muted} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.docText, done && s.docDone]}>{name}</Text>
                        {hasFile && (
                          <Text style={s.docFileName} numberOfLines={1}>
                            {docFiles[name].name}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                    {hasFile && (
                      <Pressable testID={`view-doc-${name.toLowerCase().replace(/ /g, "-")}`} onPress={() => viewFile(name)} style={s.docIconBtn}>
                        <Ionicons name="eye-outline" size={20} color={COLORS.navy} />
                      </Pressable>
                    )}
                    {canDoc && (
                      <Pressable testID={`upload-doc-${name.toLowerCase().replace(/ /g, "-")}`} onPress={() => pickAndUpload(name)} disabled={uploadingDoc === name} style={s.docIconBtn}>
                        <Ionicons name={uploadingDoc === name ? "hourglass-outline" : hasFile ? "refresh-outline" : "cloud-upload-outline"} size={20} color={COLORS.ochre} />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={s.detailCard}>
              <Text style={s.cardTitle}>Fee position</Text>
              <View style={s.feeLine}>
                <Text style={s.body}>Total fee</Text>
                <Text style={s.amount}>₹{applicant.total_fee.toLocaleString("en-IN")}</Text>
              </View>
              <View style={s.feeLine}>
                <Text style={s.body}>Paid to date</Text>
                <Text style={[s.amount, { color: COLORS.moss }]}>₹{applicant.paid.toLocaleString("en-IN")}</Text>
              </View>
              <View style={s.feeLine}>
                <Text style={s.body}>Outstanding</Text>
                <Text style={[s.amount, { color: remaining ? COLORS.ochre : COLORS.moss }]}>₹{remaining.toLocaleString("en-IN")}</Text>
              </View>
              <View style={s.progress}>
                <View style={[s.progressFill, { width: `${applicant.total_fee ? Math.min(100, (applicant.paid / applicant.total_fee) * 100) : 0}%` }]} />
              </View>
              {canPay && remaining > 0 && (
                <View style={s.payRow}>
                  <TextInput
                    testID="payment-amount-input"
                    value={payAmount}
                    onChangeText={setPayAmount}
                    placeholder="Record payment ₹"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="numeric"
                    style={s.payInput}
                  />
                  <Pressable testID="record-payment-button" onPress={addPayment} disabled={busy} style={s.payButton}>
                    <Ionicons name="add" size={20} color={COLORS.surface} />
                  </Pressable>
                </View>
              )}
            </View>

            <Text style={s.label}>ACTIVITY</Text>
            {applicant.activity
              .slice()
              .reverse()
              .map((x, i) => (
                <View key={`${x}-${i}`} style={s.activity}>
                  <View style={s.activityDot} />
                  <Text style={s.body}>{x}</Text>
                </View>
              ))}
            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        <EditApplicantModal
          visible={editing}
          applicant={applicant}
          courses={courses || []}
          onClose={() => setEditing(false)}
          onSaved={(a) => {
            setEditing(false);
            onChanged(a);
          }}
        />

        <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
          <View style={s.confirmBackdrop}>
            <View style={s.confirmCard} testID="confirm-delete-card">
              <Ionicons name="warning-outline" size={26} color={COLORS.red} />
              <Text style={s.confirmTitle}>Remove this applicant?</Text>
              <Text style={s.body}>
                {applicant.first_name} {applicant.last_name} ({applicant.application_no}) will be permanently deleted.
              </Text>
              <View style={s.confirmActions}>
                <Pressable testID="cancel-delete-button" onPress={() => setConfirmDelete(false)} style={[s.confirmBtn, s.confirmCancel]}>
                  <Text style={s.confirmCancelText}>Cancel</Text>
                </Pressable>
                <Pressable testID="confirm-delete-button" onPress={removeApplicant} style={[s.confirmBtn, s.confirmDelete]}>
                  <Text style={s.confirmDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

function EditApplicantModal({ visible, applicant, courses, onClose, onSaved }: { visible: boolean; applicant: Applicant; courses: { name: string; fee: number }[]; onClose: () => void; onSaved: (a: Applicant) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ first_name: "", last_name: "", course: "", mobile: "", email: "", quota: "CQ", total_fee: "0" });
  const [saving, setSaving] = useState(false);

  const key = `${visible}-${applicant.application_no}`;
  const [lastKey, setLastKey] = useState("");
  if (key !== lastKey) {
    setLastKey(key);
    if (visible)
      setForm({
        first_name: applicant.first_name,
        last_name: applicant.last_name || "",
        course: applicant.course || "",
        mobile: applicant.mobile || "",
        email: applicant.email || "",
        quota: applicant.quota || "CQ",
        total_fee: String(applicant.total_fee || 0),
      });
  }

  const save = async () => {
    if (!form.first_name) return toast.show("First name is required", "error");
    setSaving(true);
    try {
      const item = await api.patch(`/applicants/${applicant.application_no}`, {
        first_name: form.first_name,
        last_name: form.last_name,
        course: form.course,
        mobile: form.mobile,
        email: form.email,
        quota: form.quota,
        total_fee: Number(form.total_fee) || 0,
      });
      toast.show("Applicant updated", "success");
      onSaved(item);
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
            <Pressable testID="close-edit-button" onPress={onClose} style={s.iconButton}>
              <Ionicons name="close" size={22} color={COLORS.ink} />
            </Pressable>
            <Text style={s.modalOverline}>EDIT APPLICANT</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={s.detailContent} keyboardShouldPersistTaps="handled">
            <Text style={s.pageTitle}>{applicant.application_no}</Text>
            <Field label="First name" value={form.first_name} onChangeText={(x) => setForm({ ...form, first_name: x })} testID="edit-first_name-input" />
            <Field label="Last name" value={form.last_name} onChangeText={(x) => setForm({ ...form, last_name: x })} testID="edit-last_name-input" />
            <Field label="Mobile" value={form.mobile} onChangeText={(x) => setForm({ ...form, mobile: x })} keyboardType="phone-pad" testID="edit-mobile-input" />
            <Field label="Email" value={form.email} onChangeText={(x) => setForm({ ...form, email: x })} keyboardType="email-address" testID="edit-email-input" />
            <Field label="Total fee (₹)" value={form.total_fee} onChangeText={(x) => setForm({ ...form, total_fee: x })} keyboardType="numeric" testID="edit-fee-input" />

            <Text style={[s.label, { marginTop: 18 }]}>COURSE</Text>
            <View style={s.chipWrap}>
              {courses.map((cx) => (
                <Pressable key={cx.name} onPress={() => setForm({ ...form, course: cx.name })} style={[s.chip, form.course === cx.name && s.chipActive]}>
                  <Text style={[s.chipText, form.course === cx.name && s.chipTextActive]}>{cx.name}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[s.label, { marginTop: 18 }]}>QUOTA</Text>
            <View style={s.chipWrap}>
              {["CQ", "MQ", "NRI"].map((qx) => (
                <Pressable key={qx} onPress={() => setForm({ ...form, quota: qx })} style={[s.chip, form.quota === qx && s.chipActive]}>
                  <Text style={[s.chipText, form.quota === qx && s.chipTextActive]}>{qx}</Text>
                </Pressable>
              ))}
            </View>

            <PrimaryButton label="Save changes" onPress={save} loading={saving} testID="save-edit-button" />
            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function ImportModal({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);

  const key = String(visible);
  const [lastKey, setLastKey] = useState("");
  if (key !== lastKey) {
    setLastKey(key);
    if (visible) {
      setFileName("");
      setCsvText("");
    }
  }

  const pickCsv = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "text/plain"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const text = await (await fetch(asset.uri)).text();
      setCsvText(text);
      setFileName(asset.name || "selected.csv");
    } catch {
      toast.show("Could not read the file", "error");
    }
  };

  const runImport = async () => {
    if (!csvText.trim()) return toast.show("Pick a CSV file or paste rows first", "error");
    setBusy(true);
    try {
      const res = await api.post("/applicants/import", { csv_text: csvText });
      toast.show(`Imported ${res.created} · skipped ${res.skipped}`, res.created ? "success" : "info");
      onDone();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.modal} edges={["top", "bottom"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={s.modalHeader}>
            <Pressable testID="close-import-button" onPress={onClose} style={s.iconButton}>
              <Ionicons name="close" size={22} color={COLORS.ink} />
            </Pressable>
            <Text style={s.modalOverline}>BULK IMPORT</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={s.detailContent} keyboardShouldPersistTaps="handled">
            <Text style={s.pageTitle}>Import applicants</Text>
            <Text style={s.body}>Upload a CSV with a header row. Required columns: application_no, first_name. Optional: last_name, course, quota, email, mobile, total_fee, academic_year.</Text>

            <Pressable testID="pick-csv-button" onPress={pickCsv} style={s.pickBtn}>
              <Ionicons name="document-attach-outline" size={22} color={COLORS.navy} />
              <Text style={s.pickText}>{fileName || "Choose CSV file"}</Text>
            </Pressable>

            <Text style={[s.label, { marginTop: 18 }]}>OR PASTE CSV ROWS</Text>
            <TextInput
              testID="csv-paste-input"
              value={csvText}
              onChangeText={(t) => {
                setCsvText(t);
                if (t && !fileName) setFileName("pasted rows");
              }}
              placeholder={"application_no,first_name,course\nAPP-101,Ravi,B.Com Finance"}
              placeholderTextColor={COLORS.muted}
              multiline
              style={s.csvBox}
            />

            <PrimaryButton label="Import applicants" onPress={runImport} loading={busy} icon="cloud-upload" testID="run-import-button" />
            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function NewApplicantModal({ visible, courses, onClose, onSaved }: { visible: boolean; courses: { name: string; fee: number }[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ application_no: "", first_name: "", last_name: "", course: "", mobile: "", email: "", quota: "CQ", total_fee: 0 });
  const [saving, setSaving] = useState(false);

  const reset = () => setForm({ application_no: "", first_name: "", last_name: "", course: "", mobile: "", email: "", quota: "CQ", total_fee: 0 });

  const save = async () => {
    if (!form.application_no || !form.first_name) return toast.show("Application number and first name are required", "error");
    setSaving(true);
    try {
      await api.post("/applicants", form);
      toast.show("Application created", "success");
      reset();
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
            <Pressable testID="close-new-button" onPress={onClose} style={s.iconButton}>
              <Ionicons name="close" size={22} color={COLORS.ink} />
            </Pressable>
            <Text style={s.modalOverline}>NEW APPLICATION</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={s.detailContent} keyboardShouldPersistTaps="handled">
            <Text style={s.pageTitle}>Start a new record</Text>
            <Text style={s.body}>Add the essentials now; the review team can complete the file later.</Text>

            {[["application_no", "Application number"], ["first_name", "First name"], ["last_name", "Last name"], ["mobile", "Mobile"], ["email", "Email"]].map(([key, label]) => (
              <View style={s.field} key={key}>
                <Text style={s.label}>{label}</Text>
                <TextInput
                  testID={`new-${key}-input`}
                  value={String(form[key as keyof typeof form])}
                  onChangeText={(x) => setForm({ ...form, [key]: x })}
                  placeholder={label}
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize={key === "email" ? "none" : "sentences"}
                  keyboardType={key === "email" ? "email-address" : key === "mobile" ? "phone-pad" : "default"}
                  style={s.input}
                />
              </View>
            ))}

            <Text style={[s.label, { marginTop: 18 }]}>COURSE</Text>
            <View style={s.chipWrap}>
              {courses.map((cx) => (
                <Pressable
                  testID={`course-pick-${cx.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  key={cx.name}
                  onPress={() => setForm({ ...form, course: cx.name, total_fee: cx.fee })}
                  style={[s.chip, form.course === cx.name && s.chipActive]}
                >
                  <Text style={[s.chipText, form.course === cx.name && s.chipTextActive]}>{cx.name}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[s.label, { marginTop: 18 }]}>QUOTA</Text>
            <View style={s.chipWrap}>
              {["CQ", "MQ", "NRI"].map((qx) => (
                <Pressable testID={`quota-${qx.toLowerCase()}`} key={qx} onPress={() => setForm({ ...form, quota: qx })} style={[s.chip, form.quota === qx && s.chipActive]}>
                  <Text style={[s.chipText, form.quota === qx && s.chipTextActive]}>{qx}</Text>
                </Pressable>
              ))}
            </View>

            <PrimaryButton label="Create application" onPress={save} loading={saving} testID="save-applicant-button" />
            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  modal: { flex: 1, backgroundColor: COLORS.paper },
  modalHeader: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: COLORS.line },
  modalOverline: { color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, fontWeight: "800" },
  iconButton: { width: 44, height: 44, borderWidth: 1, borderColor: COLORS.line, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
  detailContent: { padding: 22, paddingBottom: 40 },
  detailIdentity: { alignItems: "center", marginBottom: 26 },
  avatarLarge: { width: 64, height: 64, marginBottom: 12, backgroundColor: "#E9E3D7", alignItems: "center", justifyContent: "center" },
  avatarLargeText: { color: COLORS.navy, fontWeight: "800", fontSize: 21 },
  detailName: { color: COLORS.ink, fontSize: 25, fontWeight: "800" },
  body: { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  label: { color: COLORS.muted, fontSize: 11, letterSpacing: 1.2, fontWeight: "800", marginTop: 18, marginBottom: 10 },
  stageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stagePill: { borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.surface },
  stagePillActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  stagePillText: { color: COLORS.muted, fontSize: 12, fontWeight: "700" },
  stagePillTextActive: { color: COLORS.surface },
  detailCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, padding: 16, marginTop: 22 },
  cardTitle: { color: COLORS.ink, fontSize: 17, fontWeight: "800", marginBottom: 9 },
  docRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: COLORS.line },
  docToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  docText: { color: COLORS.ink, fontSize: 14 },
  docFileName: { color: COLORS.navy, fontSize: 11, marginTop: 2 },
  docDone: { textDecorationLine: "line-through", color: COLORS.muted },
  docState: { color: COLORS.muted, fontSize: 11, fontWeight: "700" },
  docIconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  feeLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  amount: { color: COLORS.ink, fontWeight: "800" },
  progress: { height: 7, backgroundColor: COLORS.line, marginTop: 8 },
  progressFill: { height: 7, backgroundColor: COLORS.moss },
  payRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  payInput: { flex: 1, height: 48, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, color: COLORS.ink, fontSize: 15, backgroundColor: COLORS.paper },
  payButton: { width: 48, height: 48, backgroundColor: COLORS.moss, alignItems: "center", justifyContent: "center" },
  activity: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  activityDot: { width: 8, height: 8, backgroundColor: COLORS.red },
  pageTitle: { color: COLORS.ink, fontSize: 27, fontWeight: "800", marginBottom: 5 },
  field: { marginTop: 18 },
  input: { height: 50, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface, paddingHorizontal: 14, color: COLORS.ink, fontSize: 15 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  chipText: { color: COLORS.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: COLORS.surface },
  confirmBackdrop: { flex: 1, backgroundColor: "rgba(24,33,43,0.55)", alignItems: "center", justifyContent: "center", padding: 30 },
  confirmCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, padding: 22, width: "100%", maxWidth: 400, gap: 8 },
  confirmTitle: { color: COLORS.ink, fontSize: 19, fontWeight: "800", marginTop: 4 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  confirmBtn: { flex: 1, height: 48, alignItems: "center", justifyContent: "center" },
  confirmCancel: { borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.paper },
  confirmCancelText: { color: COLORS.ink, fontWeight: "800" },
  confirmDelete: { backgroundColor: COLORS.red },
  confirmDeleteText: { color: COLORS.surface, fontWeight: "800" },
  pickBtn: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: COLORS.navy, borderStyle: "dashed", padding: 16, backgroundColor: COLORS.surface },
  pickText: { color: COLORS.navy, fontWeight: "700", fontSize: 14, flex: 1 },
  csvBox: { minHeight: 120, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface, padding: 12, color: COLORS.ink, fontSize: 13, textAlignVertical: "top", fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
});
