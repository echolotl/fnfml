import { load } from '@tauri-apps/plugin-store';
import { AppSettings } from '../types';

// Define default settings
export const DEFAULT_SETTINGS: AppSettings = {
  accentColor: '#FF0088',
  installLocation: 'C:\\Users\\Public\\Documents\\FNF Mods',
  theme: 'dark',
  useSystemTheme: true,
  customCSS: '',
  validateFnfMods: true,
  showTerminalOutput: true,
};

/**
 * StoreService class for managing application settings with tauri-plugin-store
 */
export class StoreService {
  private static instance: StoreService;
  private store: Awaited<ReturnType<typeof load>> | null = null;
  private initialized = false;
  private readonly storePath = 'settings.json';
  
  // Expose default settings for migration purposes
  public readonly DEFAULT_SETTINGS = DEFAULT_SETTINGS;

  private constructor() {
    // Store will be initialized in the initialize method
  }

  /**
   * Get the singleton instance of StoreService
   */
  public static getInstance(): StoreService {
    if (!StoreService.instance) {
      StoreService.instance = new StoreService();
    }
    return StoreService.instance;
  }

  /**
   * Initialize the store
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.store = await load(this.storePath, { autoSave: true });
      this.initialized = true;
      console.log('Settings store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize settings store:', error);
      throw error;
    }
  }

  /**
   * Get a setting value
   * @param key The setting key
   * @returns The setting value, or default value if not found
   */
  public async getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.store) {
      console.error('Store not initialized');
      return DEFAULT_SETTINGS[key];
    }
    
    try {
      // Use any as intermediate type to handle complex types like ColorOption
      const value = await this.store.get<any>(key);
      return value !== null && value !== undefined ? value as AppSettings[K] : DEFAULT_SETTINGS[key];
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return DEFAULT_SETTINGS[key];
    }
  }

  /**
   * Get all settings
   * @returns All settings as an AppSettings object
   */
  public async getAllSettings(): Promise<AppSettings> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.store) {
      console.error('Store not initialized');
      return { ...DEFAULT_SETTINGS };
    }
    
    try {
      const settings = { ...DEFAULT_SETTINGS };
      
      for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof AppSettings>) {
        // Use any as intermediate type to handle complex types
        const value = await this.store.get<any>(key);
        if (value !== null && value !== undefined) {
          (settings[key] as any) = value;
        }
      }
      
      return settings;
    } catch (error) {
      console.error('Failed to get all settings:', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Save a setting
   * @param key The setting key
   * @param value The setting value
   */
  public async saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.store) {
      console.error('Store not initialized');
      throw new Error('Store not initialized');
    }
    
    try {
      // Using type assertion to handle complex types
      await this.store.set(key as string, value as any);
      // No need to manually call save() when autoSave is true
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Save multiple settings at once
   * @param settings Partial settings object
   */
  public async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.store) {
      console.error('Store not initialized');
      throw new Error('Store not initialized');
    }
    
    try {
      for (const [key, value] of Object.entries(settings)) {
        // Using type assertion to handle complex types
        await this.store.set(key, value as any);
      }
      // No need to manually call save() when autoSave is true
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Clear all settings
   */
  public async clearSettings(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.store) {
      console.error('Store not initialized');
      throw new Error('Store not initialized');
    }
    
    try {
      await this.store.clear();
      // No need to manually call save() when autoSave is true
    } catch (error) {
      console.error('Failed to clear settings:', error);
      throw error;
    }
  }
}