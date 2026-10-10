import { LocalizedText as Text } from "@/components/LocalizedText";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { reportError } from "@/lib/monitoring/sentry";
import { onboardingColors } from "@/lib/theme/onboarding";

interface FolderNameDrawerProps {
  visible: boolean;
  initialName?: string;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
  title?: string;
}

export function FolderNameDrawer({
  visible,
  initialName = "",
  onClose,
  onConfirm,
  title = "New Folder",
}: FolderNameDrawerProps) {
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const textAlign = isRTL ? "right" : "left";
  const writingDirection = isRTL ? "rtl" : "ltr";
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setError(null);
    }
  }, [visible, initialName]);

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("homeFolderNameRequired"));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onConfirm(trimmed);
      onClose();
    } catch (e) {
      reportError(e, { feature: "folder_save" });
      setError(e instanceof Error ? e.message : t("homeFolderGenericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={[styles.drawer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { textAlign }]}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <FontAwesome name="times" size={20} color={onboardingColors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { textAlign, writingDirection }]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (error) setError(null);
              }}
              placeholder={t("homeFolderNamePlaceholder")}
              placeholderTextColor={onboardingColors.textMuted}
              autoFocus
              editable={!loading}
              onSubmitEditing={handleConfirm}
              returnKeyType="done"
            />
          </View>

          {error ? <Text style={[styles.errorText, { textAlign }]}>{error}</Text> : null}

          <Pressable
            style={[
              styles.saveButton,
              (!name.trim() || loading) && styles.saveButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!name.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>{t("homeSaveFolder")}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  drawer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: onboardingColors.text,
  },
  closeButton: {
    padding: 4,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: "#E6E5DD",
    borderRadius: 12,
    backgroundColor: "#F9F9F9",
    paddingHorizontal: 16,
    height: 56,
    justifyContent: "center",
  },
  input: {
    fontSize: 16,
    color: onboardingColors.text,
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: onboardingColors.primary,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
