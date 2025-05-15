import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDrawerNavigator, DrawerItem } from '@react-navigation/drawer';
import { CommonActions, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker'; // Thêm ImagePicker
import { StatusBar } from 'expo-status-bar';
import { onValue, ref, set } from 'firebase/database'; // Thêm để lưu avatar
import { Camera, Save2, ScanBarcode, User } from 'iconsax-react-native'; // Thêm Camera icon
import React, { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { realtimeDb } from './firebase'; // Giả định bạn đã cấu hình firebase
import { appColors } from './src/constants/Colors';
import AddEditContactScreen from './src/screens/AddEditContactScreen';
import ApplyCodeScreen from './src/screens/ApplyCodeScreen';
import BackupHistoryScreen from './src/screens/BackupHistoryScreen';
import BackupScreen from './src/screens/BackupScreen';
import ContactDetailScreen from './src/screens/ContactDetailScreen';
import ContactListScreen from './src/screens/ContactListScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainDrawer: undefined;
  AddEditContact: { contact?: Contact; onSave: (contact: Contact) => void };
  ContactDetail: { contact: Contact; group?: Group };
  ForgotPassword: undefined;
  BackupHistory: undefined;
};

export type DrawerParamList = {
  ContactList: undefined;
  Backup: undefined;
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
const Drawer = createDrawerNavigator<DrawerParamList>();

const CustomDrawerContent = (props: any) => {
  const { navigation } = props;
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>('https://i.pinimg.com/736x/bc/43/98/bc439871417621836a0eeea768d60944.jpg');

  useEffect(() => {
    const initializeUserData = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail');
        const name = await AsyncStorage.getItem('userName');
        if (email) {
          setUserEmail(email);
          setUserName(name || 'Người dùng');

          const uidKey = `uid_${email}`;
          let uid = await AsyncStorage.getItem(uidKey);
          if (!uid) {
            uid = 'xxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
              const r = Math.random() * 16 | 0;
              const v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
            await AsyncStorage.setItem(uidKey, uid);
          }

          const avatarRef = ref(realtimeDb, `avatars/${uid}`);
          onValue(avatarRef, (snapshot) => {
            const data = snapshot.val();
            if (data && data.avatarBase64) {
              setAvatarUrl(`data:image/jpeg;base64,${data.avatarBase64}`);
            }
          });
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    initializeUserData();
  }, []);

  const handlePickImage = async () => {
    if (!userEmail) {
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        'Lỗi',
        'Cần cấp quyền truy cập thư viện ảnh để chọn ảnh đại diện!',
        [{ text: 'Cấp quyền', onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const base64 = result.assets[0].base64;
      if (base64) {
        try {
          const uid = await AsyncStorage.getItem(`uid_${userEmail}`);
          if (uid) {
            const avatarRef = ref(realtimeDb, `avatars/${uid}`);
            await set(avatarRef, {
              avatarBase64: base64,
              email: userEmail,
            });
            setAvatarUrl(`data:image/jpeg;base64,${base64}`);
          }
        } catch (error) {
          console.error('Lỗi khi lưu ảnh:', error);
          Alert.alert('Lỗi', 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.');
        }
      }
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('isLoggedIn');
      await AsyncStorage.removeItem('userEmail');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
      Alert.alert('Lỗi', 'Không thể đăng xuất. Vui lòng thử lại.');
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Xác nhận đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: handleLogout,
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: appColors.primary }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Phần header tùy chỉnh cho Drawer */}
        <View style={styles.drawerHeader}>
          <TouchableOpacity onPress={handlePickImage}>
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
            />
            <View style={styles.cameraButton}>
              <Camera size={16} color={appColors.secondary} variant="Bulk" />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{userName || 'Người dùng'}</Text>
          <Text style={styles.userEmail}>{userEmail || 'Chưa có email'}</Text>
        </View>

        <ScrollView style={{ backgroundColor: appColors.secondary}}>
          <DrawerItem
            label="Danh bạ"
            icon={() => <User size={24} color={appColors.primary} variant="Bulk" />}
            onPress={() => navigation.navigate('ContactList')}
            labelStyle={styles.drawerItemLabel}
            style={styles.drawerItem}
          />
          <DrawerItem
            label="Sao lưu"
            icon={() => <Save2 size={24} color={appColors.primary} variant="Bulk" />}
            onPress={() => navigation.navigate('Backup')}
            labelStyle={styles.drawerItemLabel}
            style={styles.drawerItem}
          />
          <DrawerItem
            label="Quét mã khôi phục"
            icon={() => <ScanBarcode size={24} color={appColors.primary} variant="Bulk" />}
            onPress={() => navigation.navigate('ApplyCode')}
            labelStyle={styles.drawerItemLabel}
            style={styles.drawerItem}
          />

          {/* Nút đăng xuất */}
        </ScrollView>
         <DrawerItem
            label="Đăng xuất"
            icon={() => <User size={24} color={appColors.primary2} variant="Bulk" />}
            onPress={confirmLogout}
            labelStyle={styles.logoutText}
            style={styles.logoutButton}
          />
      </SafeAreaView>
    </View>
  );
};

const MainDrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: styles.drawer,
      }}
    >
      <Drawer.Screen name="ContactList" component={ContactListScreen} />
      <Drawer.Screen name="Backup" component={BackupScreen} />
      <Drawer.Screen name="ApplyCode" component={ApplyCodeScreen} />
    </Drawer.Navigator>
  );
};

export default function App() {
  const [initialRoute, setInitialRoute] = useState<'Login' | 'MainDrawer'>('Login');

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
        setInitialRoute(isLoggedIn === 'true' ? 'MainDrawer' : 'Login');
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
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="MainDrawer" component={MainDrawerNavigator} />
          <Stack.Screen name="AddEditContact" component={AddEditContactScreen} />
          <Stack.Screen name="ContactDetail" component={ContactDetailScreen} />
          <Stack.Screen name="BackupHistory" component={BackupHistoryScreen} />
        </Stack.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: appColors.secondary,
    width: '75%',
  },
  drawerContent: {
    backgroundColor: appColors.primary2,
  },
  drawerHeader: {
    padding: 16,
    backgroundColor: appColors.primary,
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: appColors.secondary,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: appColors.primary2,
    borderRadius: 20,
    padding: 5,
  },
  userName: {
    marginTop: 10,
    color: appColors.secondary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  userEmail: {
    color: appColors.secondary,
    fontSize: 14,
    marginTop: 5,
  },
  drawerItem: {
    marginHorizontal: 0,
    paddingVertical: 8,
    borderRadius: 0,
  },
  drawerItemLabel: {
    color: appColors.primary,
    fontSize: 16,
    marginLeft: 10,
  },
  logoutButton: {
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: appColors.primary2,
  },
  logoutText: {
    color: appColors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});