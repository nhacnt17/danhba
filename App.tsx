import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import ContactListScreen from './src/screens/ContactListScreen';
import AddEditContactScreen from './src/screens/AddEditContactScreen';
import { auth } from './firebase';
import { onAuthStateChanged, User, signInWithEmailAndPassword } from 'firebase/auth';
import ContactDetailScreen from './src/screens/ContactDetailScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import SettingScreen from './src/screens/SettingScreen';
import BackupScreen from './src/screens/BackupScreen';
import ApplyCodeScreen from './src/screens/ApplyCodeScreen';
import BackupHistoryScreen from './src/screens/BackupHistoryScreen';
import { View, ActivityIndicator } from 'react-native'; 
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const Stack = createStackNavigator<RootStackParamList>();

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

const USER_STORAGE_KEY = '@user';
const CREDENTIALS_STORAGE_KEY = '@credentials';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Hàm lưu user và thông tin đăng nhập vào AsyncStorage
  const storeUserAndCredentials = async (user: User | null, email?: string, password?: string) => {
    try {
      if (user) {
        const userData = {
          uid: user.uid,
          email: user.email,
        };
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
        console.log('User stored in AsyncStorage:', user.uid);
        if (email && password) {
          const credentials = { email, password };
          await AsyncStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(credentials));
          console.log('Credentials stored in AsyncStorage');
        }
      } else {
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
        console.log('User removed from AsyncStorage');
      }
    } catch (error) {
      console.error('Error storing user/credentials in AsyncStorage:', error);
    }
  };

  // Hàm khôi phục user và thông tin đăng nhập từ AsyncStorage
  const restoreUserAndCredentials = async () => {
    try {
      const userData = await AsyncStorage.getItem(USER_STORAGE_KEY);
      const credentialsData = await AsyncStorage.getItem(CREDENTIALS_STORAGE_KEY);
      return {
        user: userData ? JSON.parse(userData) : null,
        credentials: credentialsData ? JSON.parse(credentialsData) : null,
      };
    } catch (error) {
      console.error('Error restoring user/credentials from AsyncStorage:', error);
      return { user: null, credentials: null };
    }
  };

  // Hàm thử đăng nhập lại tự động
  const attemptAutoLogin = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Auto-login successful:', userCredential.user.uid);
      return userCredential.user;
    } catch (error) {
      console.error('Auto-login failed:', error);
      return null;
    }
  };

  useEffect(() => {
    console.log('App mounted, setting up onAuthStateChanged');

    const initializeAuth = async () => {
      // Khôi phục user và thông tin đăng nhập từ AsyncStorage
      const { user: storedUser, credentials } = await restoreUserAndCredentials();
      if (storedUser) {
        console.log('User restored from AsyncStorage:', storedUser.uid);
      }

      // Lắng nghe trạng thái đăng nhập từ Firebase
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        console.log('onAuthStateChanged triggered:', currentUser ? `User logged in: ${currentUser.uid}` : 'No user');

        if (currentUser) {
          // Nếu Firebase Auth trả về user, cập nhật state và AsyncStorage
          setUser(currentUser);
          storeUserAndCredentials(currentUser);
        } else if (storedUser && credentials) {
          // Nếu Firebase Auth trả về No user, nhưng có thông tin trong AsyncStorage, thử đăng nhập lại
          console.log('Attempting auto-login with stored credentials');
          const autoLoggedInUser = await attemptAutoLogin(credentials.email, credentials.password);
          if (autoLoggedInUser) {
            setUser(autoLoggedInUser);
            storeUserAndCredentials(autoLoggedInUser);
          } else {
            // Nếu đăng nhập lại thất bại, xóa user và yêu cầu đăng nhập thủ công
            setUser(null);
            storeUserAndCredentials(null);
          }
        } else {
          // Không có user và không có thông tin trong AsyncStorage
          setUser(null);
          storeUserAndCredentials(null);
        }

        setInitializing(false);
      }, (error) => {
        console.error('onAuthStateChanged error:', error);
        setUser(null);
        setInitializing(false);
      });

      return () => {
        console.log('App unmounted, cleaning up onAuthStateChanged');
        unsubscribe();
      };
    };

    initializeAuth();
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#effafe' }}>
        <ActivityIndicator size="large" color="#1c4550" />
      </View>
    );
  }

  console.log('Rendering NavigationContainer, user:', user ? user.uid : 'No user');

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#f8f8f8' },
          headerTintColor: '#000',
        }}
      >
        {user ? (
          // Màn hình sau khi đăng nhập
          <>
            <Stack.Screen
              name="ContactList"
              component={ContactListScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="AddEditContact"
              component={AddEditContactScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="ContactDetail"
              component={ContactDetailScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Setting"
              component={SettingScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Backup"
              component={BackupScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="BackupHistory"
              component={BackupHistoryScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="ApplyCode"
              component={ApplyCodeScreen}
              options={{
                headerShown: false,
              }}
            />
          </>
        ) : (
          // Màn hình đăng nhập/đăng ký
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{
                headerShown: false,
                animation: 'fade_from_bottom',
              }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{
                headerShown: false,
                animation: 'fade_from_bottom',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}