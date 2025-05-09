<template>
  <div class="mods-title" v-if="mods.length >= 0">
    <div class="header">
    <h5 class="phantom-font-difficulty">Installed Mods</h5>
    <div class="scan-actions">
        <q-btn
          round
          color="primary"
          icon="refresh"
          @click="scanForMods"
          :loading="loading"
          flat
        />
        <q-btn
          color="transparent"
          text-color="var(--theme-text-secondary)"
          icon="folder"
          label="Open Mods Folder"
          flat
          @click="openModsFolder"
        />
      </div>
  </div>
    <hr />
  </div>

  <div class="engine-mods-container phantom-font" v-if="!isUnsupportedEngine">
    <div v-if="loading" class="loading">
      <q-spinner color="primary" size="36px" />
      <span>Scanning for installed mods...</span>
    </div>

    <div v-else-if="error" class="error-message">
      <q-icon name="error" color="negative" size="24px" />
      <span>{{ error }}</span>
    </div>

    <div v-else-if="mods.length === 0" class="no-mods">
      <q-icon name="folder_off" size="36px" />
      <span>No mods found for this engine</span>
    </div>

    <div v-else class="mods-list">
      <div v-for="mod in mods" :key="mod.folder_path" class="mod-item">
        <div class="mod-icon">
          <q-img
            v-if="mod.icon_data"
            :src="mod.icon_data"
            spinner-color="primary"
            style="height: 48px; width: 48px"
            @error="handleImageError"
          >
            <template v-slot:error>
              <div class="fallback-icon">
                <q-icon name="image_not_supported" size="32px" />
              </div>
            </template>
          </q-img>
          <div v-else class="fallback-icon">
            <q-icon name="image_not_supported" size="32px" />
          </div>
        </div>
        <div class="mod-info">
          <div class="mod-name">{{ mod.name }}</div>
          <div
            v-if="mod.description"
            class="mod-description"
            v-html="formatDescription(mod.description)"
          ></div>
        </div>
        <div class="mod-actions">
          <q-toggle
            v-model="mod.enabled"
            :disable="
              engineType === 'codename' || toggleLoading[mod.folder_path]
            "
            :loading="toggleLoading[mod.folder_path]"
            @update:model-value="(val) => toggleModEnabled(mod, val)"
            color="primary"
            size="md"
          />
        </div>
      </div>
    </div>
  </div>
  <div v-else class="engine-mods-container phantom-font">
    <div class="loading">
      <span>Fridaylight can't scan for mods with the current engine type. You can disable this section in the mod settings.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { sep } from "@tauri-apps/api/path";

interface ModMetadataFile {
  name: string;
  description?: string;
  folder_path: string;
  config_file_path?: string;
  icon_file_path?: string;
  icon_data?: string;
  enabled: boolean;
}

interface EngineModsResponse {
  engine_type: string;
  executable_path: string;
  mods: ModMetadataFile[];
}

const props = defineProps({
  executablePath: {
    type: String,
    default: "",
  },
  engineType: {
    type: String,
    default: "",
  },
  autoScan: {
    type: Boolean,
    default: true,
  },
  customModsFolder: {
    type: String,
    default: null,
  },
});

const mods = ref<ModMetadataFile[]>([]);
const loading = ref(false);
const error = ref("");
const hasScanned = ref(false);
const toggleLoading = ref<Record<string, boolean>>({}); // Track loading state for each toggle

const isUnsupportedEngine = computed(() => {
  return ["pre-vslice", "kade", "other", "unknown"].includes(props.engineType);
});

const scanForMods = async () => {
  if (!props.executablePath || !props.engineType) {
    error.value = "Missing executable path or engine type";
    return;
  }

  // Handle "other" engine type as if it doesn't have a type
  if (props.engineType === "other" || props.engineType === "unknown") {
    error.value = "Custom engine types are not supported for mod scanning";
    return;
  }

  loading.value = true;
  error.value = "";
  mods.value = [];

  try {
    const response = await invoke<EngineModsResponse>("find_engine_mod_files", {
      executablePath: props.executablePath,
      engineType: props.engineType,
      modsFolder: props.customModsFolder,
    });

    mods.value = response.mods;
    hasScanned.value = true;
  } catch (e: any) {
    console.error("Failed to scan for mods:", e);
    error.value = e.toString();
  } finally {
    loading.value = false;
  }
};

const handleImageError = () => {
  // This function can be expanded to handle image loading errors if needed
  console.warn("Failed to load mod icon");
};

// Format description text with line breaks
const formatDescription = (description: string) => {
  if (!description) return "";

  // Replace newlines with HTML line breaks
  return (
    description
      .replace(/\n/g, "<br>")
      // Make URLs clickable
      .replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener">$1</a>'
      )
      // Highlight specific keywords like "License:", "Credits:", etc.
      .replace(
        /(License|Website|Credits|By|Author|Developer|Contributor):/g,
        "<strong>$1:</strong>"
      )
  );
};

// Toggle a mod's enabled state
const toggleModEnabled = async (mod: ModMetadataFile, enable: boolean) => {
  if (!props.executablePath || !props.engineType) {
    console.error("Missing executable path or engine type");
    return;
  }

  // Skip for Codename Engine
  if (props.engineType === "codename") {
    console.warn("Mod enabling/disabling not supported for Codename Engine");
    return;
  }

  // Set loading state for this specific toggle
  toggleLoading.value[mod.folder_path] = true;

  try {
    const result = await invoke<{
      success: boolean;
      enabled: boolean;
      message: string;
    }>("toggle_mod_enabled", {
      executablePath: props.executablePath,
      modFolderPath: mod.folder_path,
      engineType: props.engineType,
      enable,
    });

    console.log(
      `Toggled mod ${mod.name} to ${result.enabled ? "enabled" : "disabled"}`
    );

    // Update the mod's enabled state based on the result
    mod.enabled = result.enabled;
  } catch (e: any) {
    console.error(`Failed to toggle mod ${mod.name}:`, e);
    // Reset the toggle to its previous state on error
    mod.enabled = !enable;
  } finally {
    // Clear loading state
    toggleLoading.value[mod.folder_path] = false;
  }
};

// Get the mods folder path
const getModsFolderPath = (): string => {

  // Get the directory of the executable
  const executablePath = props.executablePath;
  const lastSlashIndex = Math.max(
    executablePath.lastIndexOf("/"),
    executablePath.lastIndexOf("\\")
  );
  
  const baseDir = lastSlashIndex > 0 
    ? executablePath.substring(0, lastSlashIndex) 
    : executablePath;
    
  // Most engines use "mods" folder in the same directory as the executable
  return `${baseDir}${sep()}${props.customModsFolder || "mods"}${sep()}`;
};

// Open mods folder in file explorer
const openModsFolder = async () => {
  try {
    const folderPath = getModsFolderPath();
    if (!folderPath) {
      error.value = "Could not determine mods folder path";
      return;
    }
    
    console.log("Opening mods folder:", folderPath);
    await revealItemInDir(folderPath);
  } catch (e: any) {
    console.error("Failed to open mods folder:", e);
    error.value = `Failed to open mods folder: ${e.toString()}`;
  }
};

// Watch for changes in executable path or engine type
watch(
  () => [props.executablePath, props.engineType],
  () => {
    if (props.autoScan && props.executablePath && props.engineType) {
      scanForMods();
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (props.autoScan && props.executablePath && props.engineType) {
    scanForMods();
  }
});
</script>

<style scoped>
.engine-mods-container {
  margin-top: 0.25rem;
  background: var(--theme-surface);
  border-radius: 8px;
  padding: 16px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h5 {
  margin: 0;
  margin-top: 2rem;
  color: var(--theme-text);
  width: fit-content;
  display: inline-flex;
}

.engine-badge {
  font-size: 14px;
  padding: 4px 8px;
}

.mods-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.mod-item {
  display: flex;
  align-items: center;
  padding: 10px;
  background: var(--theme-card);
  border-radius: 6px;
  transition: background-color 0.2s;
  border: 1px solid var(--theme-border);
}

.mod-item:hover {
  background: var(--theme-border);
}

.mod-icon {
  width: 48px;
  height: 48px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fallback-icon {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-text-secondary);
}

.mod-info {
  flex: 1;
}

.mod-name {
  font-weight: bold;
  font-size: 16px;
  color: var(--theme-text);
  margin-bottom: 4px;
}

.mod-description {
  font-size: 14px;
  color: var(--theme-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.loading,
.no-mods,
.error-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: var(--theme-text-secondary);
  text-align: center;
  gap: 12px;
}

.error-message {
  color: #ff5252;
}

.scan-actions {
  display: inline-flex;
  gap: .5rem;
  margin-left: auto;
  margin-top: 1.5rem;

}
</style>
