export type RootStackParamList = {
  Chats: undefined;
  Chat: { id: string };
  /** Tanpa id berarti membuat kontak baru. */
  Contact: { id?: string };
  Settings: undefined;
  /** Konfigurasi koneksi; tanpa id berarti membuat konfigurasi baru. */
  Provider: { id?: string };
  /**
   * Pemilih model. `contactId` mengubah override satu kontak, `providerId`
   * mengubah model bawaan sebuah konfigurasi koneksi.
   */
  ModelPicker: { contactId?: string; providerId?: string };
};
