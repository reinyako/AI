import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RootStackParamList } from './src/navigation';
import { ChatScreen } from './src/screens/ChatScreen';
import { ChatsScreen } from './src/screens/ChatsScreen';
import { ContactScreen } from './src/screens/ContactScreen';
import { ModelPickerScreen } from './src/screens/ModelPickerScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StoreProvider } from './src/store/StoreProvider';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const scheme = useColorScheme();
  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="auto" />
          <Stack.Navigator
            screenOptions={{
              headerBackTitle: 'Pesan',
              headerTitleStyle: { fontSize: 17 },
            }}
          >
            <Stack.Screen
              name="Chats"
              component={ChatsScreen}
              options={{ title: 'Pesan', headerLargeTitle: true }}
            />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '' }} />
            <Stack.Screen
              name="Contact"
              component={ContactScreen}
              options={{ title: 'Kontak' }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Pengaturan' }} />
            <Stack.Screen name="ModelPicker" component={ModelPickerScreen} options={{ title: 'Model' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
