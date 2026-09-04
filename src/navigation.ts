export type RootStackParamList = {
  Chats: undefined;
  Chat: { id: string };
  /** Tanpa id berarti membuat kontak baru. */
  Contact: { id?: string };
  Settings: undefined;
  /** Pemilih model: mengubah default global atau setelan satu kontak. */
  ModelPicker: { contactId?: string };
};
