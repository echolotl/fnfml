<template>
  <div>
    <q-scroll-area style="height: 100%">
      <q-list padding class="phantom-font" style="color: var(--theme-text);">        <q-item-label header class="flex justify-between items-center">
          Mods
          <div class="flex">
            <q-btn flat round dense icon="settings" @click="$emit('open-settings')" class="q-mr-xs" />
            <q-btn flat round dense icon="add" @click="$emit('add-mod')" class="q-mr-xs" />
            <q-btn flat round dense icon="folder_open" @click="$emit('add-mods-folder')" tooltip="Import Folder of Mods" />
          </div>
        </q-item-label>
        
        <!-- Downloading mods section -->
        <template v-if="Object.keys(downloadingMods).length > 0">
          <q-item-label header class="text-grey-5">
            Downloading
          </q-item-label>
          
          <q-item 
            v-for="download in downloadingMods" 
            :key="`dl-${download.modId}`"
            class="downloading-mod"
          >
            <q-item-section avatar>
              <q-spinner size="32px" v-if="!download.isComplete && !download.isError" color="primary" />
              <q-icon name="check_circle" color="positive" size="32px" v-else-if="download.isComplete" />
              <q-icon name="error" color="negative" size="32px" v-else-if="download.isError" />
            </q-item-section>
            
            <q-item-section>
              <q-item-label>{{ download.name }}</q-item-label>
              <q-item-label caption>{{ download.step }}</q-item-label>
              
              <q-linear-progress
                v-if="!download.isComplete && !download.isError"
                :value="download.percentage / 100"
                color="primary"
                class="q-mt-xs"
                rounded
                size="8px"
              />
              
              <q-item-label caption class="text-negative" v-if="download.isError">
                {{ download.error }}
              </q-item-label>
            </q-item-section>
          </q-item>
          
          <q-separator spaced />
        </template>
        
        <!-- Installed mods list -->
        <q-item-label header class="text-grey-5">
          Installed
        </q-item-label>
        
        <!-- Sortable Mod list items -->
        <draggable 
          v-model="modsList" 
          group="mods" 
          item-key="id"
          @end="onDragEnd"
          @start="onDragStart"
          class="full-width"
          :animation="200"
          ghost-class="sortable-ghost"
          chosen-class="sortable-chosen"
          drag-class="sortable-drag"
          :force-fallback="true"
          :delay="50"
          :delayOnTouchOnly="true"
        >
          <template #item="{element: mod}">
            <q-item 
              :key="mod.id" 
              clickable 
              v-ripple 
              @click="$emit('select-mod', mod)"
              :active="selectedModId === mod.id"
              active-class="active-mod"
              class="draggable-item cursor-move"
            >      
              <q-item-section avatar v-if="mod.icon_data">
                <q-avatar size="32px" square>
                  <img :src="mod.icon_data" alt="mod icon" />
                </q-avatar>
              </q-item-section>
              <q-item-section avatar v-else>
                <q-avatar size="32px" icon="folder" square class="default-icon" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ mod.name }}</q-item-label>
                <q-item-label caption class="version-text" v-if="mod.version">v{{ mod.version }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  icon="delete"
                  color="grey-5"
                  @click.stop="confirmDelete(mod)"
                  class="delete-btn"
                />
              </q-item-section>
            </q-item>
          </template>
        </draggable>
        
        <!-- Empty state when no mods -->
        <q-item v-if="mods.length === 0">
          <q-item-section>
            <q-item-label caption>
              No mods added. Click the + button to add a mod folder.
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-scroll-area>    <!-- Delete confirmation dialog -->
    <q-dialog v-model="showDeleteDialog" persistent>
      <q-card class="phantom-font" style="background-color: var(--theme-card); color: var(--theme-text);">
        <q-card-section class="row items-center">
          <q-avatar icon="warning" color="negative" text-color="white" />
          <span class="q-ml-sm">Are you sure you want to delete this mod?</span>
        </q-card-section>
        <q-card-section v-if="modToDelete">
          <div class="text-h6">{{ modToDelete.name }}</div>
          <div class="text-caption">{{ modToDelete.path }}</div>
          <p class="text-body2 q-mt-sm">
            This will only remove the mod from the launcher. The mod files will not be deleted.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat label="Delete" color="negative" @click="deleteMod" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { downloadingMods } from '../../stores/downloadState';
import draggable from 'vuedraggable';

interface Engine {
  engine_type: string;
  engine_name: string;
  engine_icon: string;
  mods_folder: boolean;
  mods_folder_path: string;
}

interface Mod {
  id: string;
  name: string;
  path: string;
  executable_path?: string;
  icon_data?: string;
  banner_data?: string;
  logo_data?: string | null;
  version?: string;
  engine_type?: string;  // Kept for backward compatibility (probably will remove for full release)
  engine: Engine;        // New extended engine information
  display_order?: number;
}

const props = defineProps({
  mods: {
    type: Array as () => Mod[],
    required: true
  },
  selectedModId: {
    type: String,
    default: ''
  }
});

// Create a local reactive copy of the mods array for reordering
const modsList = ref<Mod[]>([]);

// Initialize modsList when component is first created
watch(() => props.mods, (newMods) => {
  if (newMods && newMods.length > 0) {
    console.log('ModList received new mods from parent with display_order:', 
      newMods.map(mod => ({ name: mod.name, display_order: mod.display_order })));
    modsList.value = [...newMods];
  }
}, { immediate: true, deep: true });

const emit = defineEmits(['select-mod', 'add-mod', 'add-mods-folder', 'delete-mod', 'open-settings', 'reorder-mods']);

const showDeleteDialog = ref(false);
const modToDelete = ref<Mod | null>(null);

const confirmDelete = (mod: Mod) => {
  modToDelete.value = mod;
  showDeleteDialog.value = true;
};

const deleteMod = () => {
  if (modToDelete.value) {
    emit('delete-mod', modToDelete.value.id);
    modToDelete.value = null;
  }
};

// Function to handle when drag starts
const onDragStart = () => {
  console.log('Drag started, current order:', modsList.value.map(mod => mod.name));
};

// Function to handle when drag ends
const onDragEnd = () => {
  // Compare the old and new orders to see if they're actually different
  const oldNames = props.mods.map(mod => mod.name).join(',');
  const newNames = modsList.value.map(mod => mod.name).join(',');
  
  console.log('Drag ended, new order:', modsList.value.map(mod => mod.name));
  console.log('Drag ended, display_order values:', modsList.value.map(mod => ({ name: mod.name, display_order: mod.display_order })));
  
  if (oldNames !== newNames) {
    console.log('Order changed, emitting new order');
    
    // Clone the modsList to avoid Vue's reactivity issues with nested objects
    const modsToEmit = modsList.value.map(mod => ({...mod}));
    
    // Emit the reordered list to the parent component
    emit('reorder-mods', modsToEmit);
  } else {
    console.log('No order change detected');
  }
};
</script>

<style scoped>
.active-mod {
  background-color: var(--theme-surface);
  border-radius: 0 1rem 1rem 0;
}

.default-icon {
  color: var(--theme-text-secondary) !important;
  background-color: transparent;
  border-radius: 4px;
}

/* Target the inner icon within the q-avatar */
.default-icon .q-icon {
  color: var(--theme-text-secondary) !important;
}

.q-avatar img {
  object-fit: contain;
  background-color: transparent;
  image-rendering: pixelated;
  border-radius: 0;
}

.q-item {
  border-radius: 0 1rem 1rem 0;
}

.draggable-item {
  transition: background-color 0.2s ease;
  position: relative;
}

.draggable-item:hover {
  background-color: var(--theme-surface);
}

.draggable-item * {
  user-select: none;
}

.cursor-move {
  cursor: move; /* fallback for older browsers */
  cursor: grab;
}

.cursor-move:active {
  cursor: grabbing;
}

/* Add styles for when an item is being dragged */
.sortable-ghost {
  background-color: var(--theme-surface) !important;
  border-radius: 0 1rem 1rem 0;
  opacity: 0.5;
}

/* Add styles for when an item is being dropped */
.sortable-chosen {
  background-color: var(--theme-surface) !important;
  box-shadow: 0 0 10px var(--theme-border);
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.q-item:hover .delete-btn {
  opacity: 1;
}

.version-text {
  color: #999999 !important;
}

.downloading-mod {
  margin-bottom: 8px;
}

.sortable-list {
  background: transparent !important;
}
.q-item__label {
  line-height: 1.2;
}
</style>