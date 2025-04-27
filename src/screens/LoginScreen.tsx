import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { auth } from '../../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Eye, EyeSlash } from 'iconsax-react-native';
import { appColors } from '../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const USER_STORAGE_KEY = '@user';
const CREDENTIALS_STORAGE_KEY = '@credentials';

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Lưu user và thông tin đăng nhập vào AsyncStorage
      const userData = {
        uid: user.uid,
        email: user.email,
      };
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      await AsyncStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify({ email, password }));
      console.log('User and credentials stored after login:', user.uid);
    } catch (error: any) {
      Alert.alert('Lỗi', 'Tài khoản không tồn tại hoặc mật khẩu không chính xác');
      console.log('Login error:', error.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Lỗi', 'Vui lòng nhập email để đặt lại mật khẩu.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Thành công', 'Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư của bạn.');
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể gửi email đặt lại mật khẩu. Vui lòng kiểm tra lại địa chỉ email của bạn.');
      console.log('Forgot password error:', error.message);
    }
  };

  return (
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

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Đăng nhập</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={styles.forgotPassword}>Quên mật khẩu?</Text>
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
  forgotPassword: {
    marginTop: 16,
    color: '#1c4550',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
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