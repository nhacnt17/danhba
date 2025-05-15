import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, Alert, ActivityIndicator, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { db } from '../../firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Eye, EyeSlash } from 'iconsax-react-native';
import { appColors } from '../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native'; // Thêm import này để sử dụng reset

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false); // Thêm state loading

  const checkEmailUnique = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const userDocRef = doc(db, 'users', normalizedEmail);
    const docSnap = await getDocs(collection(db, 'users'));
    return !docSnap.docs.some(doc => doc.id === normalizedEmail);
  };

  const handleRegister = async () => {
    if (!name.trim()) return Alert.alert('Lỗi', 'Tên không được để trống');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Alert.alert('Lỗi', 'Email không hợp lệ');
    if (password !== confirmPassword) return Alert.alert('Lỗi', 'Mật khẩu không khớp');

    setLoading(true); // Bắt đầu loading

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const isEmailUnique = await checkEmailUnique(normalizedEmail);
      if (!isEmailUnique) {
        setLoading(false); // Dừng loading khi có lỗi
        return Alert.alert('Lỗi', 'Email đã được sử dụng');
      }

      const userRef = doc(db, 'users', normalizedEmail);
      await setDoc(userRef, {
        name: name,
        email: normalizedEmail,
        password: password,
        createdAt: new Date().toISOString(),
      });

      console.log('Đã lưu tài khoản:', { name: name, email: normalizedEmail });
      await AsyncStorage.multiSet([['isLoggedIn', 'true'], ['userEmail', normalizedEmail], ['userName', name]]);
      setLoading(false);

      // Sử dụng reset để đặt lại stack và điều hướng đến MainDrawer với ContactList
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'MainDrawer', params: { screen: 'ContactList' } }],
        })
      );
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Lỗi', 'Không thể đăng ký. Vui lòng thử lại.');
      console.log('Register error:', error.message);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Tạo tài khoản mới</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Tên"
              placeholderTextColor="#8a9ba5"
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
            />
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
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <Eye size="26" color={appColors.primary} variant="Bulk" /> : <EyeSlash size="26" color={appColors.primary} variant="Bulk" />}
              </TouchableOpacity>
            </View>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Xác nhận mật khẩu"
                placeholderTextColor="#8a9ba5"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? <Eye size="26" color={appColors.primary} variant="Bulk" /> : <EyeSlash size="26" color={appColors.primary} variant="Bulk" />}
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={appColors.secondary} />
            ) : (
              <Text style={styles.buttonText}>Đăng ký</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>
              Đã có tài khoản? <Text style={styles.linkHighlight}>Đăng nhập</Text>
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
  inputContainer: { gap: 16 },
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
  eyeIcon: { padding: 10 },
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
  loginLink: {
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