import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ContactListScreen from './src/screens/ContactListScreen';
import AddEditContactScreen from './src/screens/AddEditContactScreen';
import ContactDetailScreen from './src/screens/ContactDetailScreen';
import SettingScreen from './src/screens/SettingScreen';
import BackupScreen from './src/screens/BackupScreen';
import ApplyCodeScreen from './src/screens/ApplyCodeScreen';
import BackupHistoryScreen from './src/screens/BackupHistoryScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ContactList: undefined;
  AddEditContact: { contact?: Contact; onSave: (contact: Contact) => void };
  ContactDetail: { contact: Contact; group?: Group };
  Setting: undefined;
  Backup: undefined;
  BackupHistory: undefined;
  ApplyCode: undefined;
};

export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarBase64?: string;
  email?: string;
  groupId?: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
}

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<'Login' | 'ContactList'>('Login');

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
        setInitialRoute(isLoggedIn === 'true' ? 'ContactList' : 'Login');
      } catch (error) {
        console.error('Error reading AsyncStorage:', error);
        setInitialRoute('Login');
      }
    };
    checkLoginStatus();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade_from_bottom',
          }}
          initialRouteName={initialRoute}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ContactList" component={ContactListScreen} />
          <Stack.Screen name="AddEditContact" component={AddEditContactScreen} />
          <Stack.Screen name="ContactDetail" component={ContactDetailScreen} />
          <Stack.Screen name="Setting" component={SettingScreen} />
          <Stack.Screen name="Backup" component={BackupScreen} />
          <Stack.Screen name="BackupHistory" component={BackupHistoryScreen} />
          <Stack.Screen name="ApplyCode" component={ApplyCodeScreen} />
        </Stack.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}