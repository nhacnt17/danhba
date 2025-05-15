import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Eye, EyeSlash } from 'iconsax-react-native';
import { appColors } from '../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native'; // Thêm import này để sử dụng reset

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return Alert.alert('Lỗi', 'Email không hợp lệ');
    if (!password.trim()) return Alert.alert('Lỗi', 'Mật khẩu không được để trống');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const userRef = doc(db, 'users', normalizedEmail);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists() && userSnap.data().password === password) {
        await AsyncStorage.setItem('isLoggedIn', 'true');
        await AsyncStorage.setItem('userEmail', normalizedEmail);
        
        // Sử dụng reset để đặt lại stack và điều hướng đến MainDrawer với ContactList
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'MainDrawer', params: { screen: 'ContactList' } }],
          })
        );
      } else {
        Alert.alert('Lỗi', 'Email hoặc mật khẩu không chính xác');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể đăng nhập. Vui lòng kiểm tra kết nối.');
      console.log('Login error:', error.message);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Đăng nhập</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#8a9ba5"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Mật khẩu"
                placeholderTextColor="#8a9ba5"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <Eye size="26" color={appColors.primary} variant="Bulk" />
                ) : (
                  <EyeSlash size="26" color={appColors.primary} variant="Bulk" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.forgotPasswordLink}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.linkHighlight}>Quên mật khẩu?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Đăng nhập</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.linkText}>
              Chưa có tài khoản? <Text style={styles.linkHighlight}>Đăng ký ngay</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#effafe',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1c4550',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    gap: 16,
  },
  input: {
    backgroundColor: '#f5f9fa',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1c4550',
    borderWidth: 1,
    borderColor: '#e0e7ea',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e7ea',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#1c4550',
  },
  eyeIcon: {
    padding: 10,
  },
  forgotPasswordLink: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  button: {
    backgroundColor: '#1c4550',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  registerLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 16,
    color: '#5c6b73',
  },
  linkHighlight: {
    color: '#1c4550',
    fontWeight: '600',
  },
});