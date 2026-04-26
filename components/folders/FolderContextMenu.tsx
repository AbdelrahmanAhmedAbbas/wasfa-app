import { LocalizedText as Text } from "@/components/LocalizedText";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";
import { RecipeFolder } from "@/lib/recipes/client";

interface FolderContextMenuProps {
  folder: RecipeFolder | null;
  visible: boolean;
  onClose: () => void;
  onRename: (folder: RecipeFolder) => void;
  onDelete: (folder: RecipeFolder) => void;
}

export function FolderContextMenu({
  folder,
  visible,
  onClose,
  onRename,
  onDelete,
}: FolderContextMenuProps) {
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const textAlign = isRTL ? "right" : "left";

  if (!folder) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.menu, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { textAlign }]} numberOfLines={1}>
              {folder.name}
            </Text>
          </View>

          <Pressable
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onRename(folder);
            }}
          >
            <FontAwesome name="pencil" size={20} color={onboardingColors.text} />
            <Text style={[styles.menuItemText, { textAlign }]}>{t("homeRenameFolder")}</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onDelete(folder);
            }}
          >
            <FontAwesome name="trash-o" size={20} color="#D32F2F" />
            <Text style={[styles.menuItemText, { color: "#D32F2F", textAlign }]}>
              {t("homeDeleteFolderTitle")}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  menu: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "600",
    color: onboardingColors.text,
  },
});
