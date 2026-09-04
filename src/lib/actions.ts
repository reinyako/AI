import { ActionSheetIOS, Alert, Platform } from 'react-native';

export type SheetAction = {
  label: string;
  destructive?: boolean;
  run: () => void;
};

/** Menu aksi: pakai action sheet asli di iOS, Alert di platform lain. */
export function showActions(title: string, actions: SheetAction[]) {
  if (Platform.OS === 'ios') {
    const options = [...actions.map((action) => action.label), 'Batal'];
    const destructiveIndex = actions.findIndex((action) => action.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
      },
      (index) => {
        if (index < actions.length) actions[index].run();
      }
    );
    return;
  }

  Alert.alert(title, undefined, [
    ...actions.map((action) => ({
      text: action.label,
      style: action.destructive ? ('destructive' as const) : ('default' as const),
      onPress: action.run,
    })),
    { text: 'Batal', style: 'cancel' as const },
  ]);
}
