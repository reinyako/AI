import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RootStackParamList } from './src/navigation';
import { ChatScreen } from './src/screens/ChatScreen';
import { ChatsScreen } from './src/screens/ChatsScreen';
import { ContactScreen } from './src/screens/ContactScreen';
import { ModelPickerScreen } from './src/screens/ModelPickerScreen';
import { ProviderScreen } from './src/screens/ProviderScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StoreProvider } from './src/store/StoreProvider';
import { SHAPE, ThemeProvider, useTheme } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

function Shell() {
  const theme = useTheme();

  /**
   * Tema navigasi dibangun dari palet aplikasi sendiri. Memakai DefaultTheme/DarkTheme
   * apa adanya membuat latar header dan latar transisi memakai warna bawaan React
   * Navigation, yang tidak selalu cocok dengan mode gelap.
   */
  const navTheme = useMemo<Theme>(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: theme.dark,
      colors: {
        ...base.colors,
        primary: theme.blue,
        background: theme.bg,
        card: theme.nav,
        text: theme.label,
        border: theme.separator,
        notification: theme.danger,
      },
    };
  }, [theme]);

  const screenOptions = useMemo<NativeStackNavigationOptions>(() => {
    const shared: NativeStackNavigationOptions = {
      headerBackTitle: 'Pesan',
      headerTintColor: theme.blue,
      headerTitleStyle: { fontSize: 17, color: theme.label },
      headerLargeTitleStyle: { color: theme.label },
      contentStyle: { backgroundColor: theme.bg },
    };

    // Di iOS 26 latar header dibiarkan kosong supaya UIKit memasang Liquid Glass
    // sendiri; menyetel backgroundColor akan memaksa header jadi opak.
    if (SHAPE.glass) return shared;

    // Di iOS 18 ke bawah, kedua tampilan navigation bar harus diwarnai sendiri.
    // `headerLargeStyle` yang dibiarkan kosong itulah yang membuat bagian atas
    // berkedip putih saat kembali dari layar chat walau memakai tema gelap:
    // tampilan large-title jatuh ke latar sistem, bukan ke tema aplikasi.
    return {
      ...shared,
      headerStyle: { backgroundColor: theme.nav },
      headerLargeStyle: { backgroundColor: theme.bg },
    };
  }, [theme]);

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen
          name="Chats"
          component={ChatsScreen}
          options={{ title: 'Pesan', headerLargeTitleEnabled: true }}
        />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '' }} />
        <Stack.Screen name="Contact" component={ContactScreen} options={{ title: 'Kontak' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Pengaturan' }} />
        <Stack.Screen name="Provider" component={ProviderScreen} options={{ title: 'Konfigurasi' }} />
        <Stack.Screen name="ModelPicker" component={ModelPickerScreen} options={{ title: 'Model' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StoreProvider>
          <Shell />
        </StoreProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
