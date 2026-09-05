import * as Haptics from 'expo-haptics';

/** Getar halus; sengaja dibungkus supaya kegagalan di simulator/web tidak bikin crash. */
export const tapFeedback = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export const successFeedback = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};
