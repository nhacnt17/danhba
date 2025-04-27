import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signOut } from 'firebase/auth';
import { ArrowCircleLeft } from 'iconsax-react-native';
import React from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RootStackParamList } from '../../App';
import { auth } from '../../firebase';
import { appColors } from '../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Setting'>;

const USER_STORAGE_KEY = '@user';
const CREDENTIALS_STORAGE_KEY = '@credentials';

const SettingScreen = ({ navigation }: Props) => {
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.navigate('Login');
      // Xóa thông tin user và credentials khỏi AsyncStorage
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      await AsyncStorage.removeItem(CREDENTIALS_STORAGE_KEY);
      console.log('User logged out successfully and AsyncStorage cleared');
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
      Alert.alert('Lỗi', 'Không thể đăng xuất. Vui lòng thử lại.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.primary }}>
      <View style={styles.Header}>
        <View style={{ width: 50 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowCircleLeft size="34" color="#FF8A65" variant="Bulk" />
          </TouchableOpacity>
        </View>
        <Text style={styles.tileHeader}>Cài đặt</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Backup')}
        >
          <Text style={styles.buttonText}>Sao lưu dữ liệu</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('ApplyCode')}
        >
          <Text style={styles.buttonText}>Áp dụng mã chia sẻ</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
};

export default SettingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.secondary,
    padding: 16,
    alignItems: 'center',
  },
  Header: {
    height: 60,
    width: '100%',
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tileHeader: {
    fontSize: 18,
    color: appColors.secondary,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: appColors.primary,
    marginBottom: 20,
  },
  button: {
    width: '100%',
    backgroundColor: appColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: appColors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    position: 'absolute',
    bottom: 30,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  logoutText: {
    color: appColors.primary2,
    fontSize: 16,
    fontWeight: 'bold',
  },
});