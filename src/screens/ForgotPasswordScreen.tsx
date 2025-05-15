import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { RootStackParamList } from '../../App';
import { db } from '../../firebase';
// Thêm dòng này
import {
  MAILERSEND_API_KEY,
  VERIFIED_SENDER_EMAIL
} from '@env';



type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null); 

  const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

  const checkEmailExists = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    console.log('Checking email:', normalizedEmail);

    try {
      const userRef = doc(db, 'users', normalizedEmail); 
      const userSnap = await getDoc(userRef);
      console.log('Found user:', userSnap.exists(), userSnap.data());

      if (!userSnap.exists()) {
        console.log('Email not found in Firestore');
        return null;
      }

      return normalizedEmail; 
    } catch (error: any) {
      console.error('Error checking email:', error.message, error.code);
      Alert.alert('Lỗi', `Không thể kiểm tra email: ${error.message}. Kiểm tra console log.`);
      return null;
    }
  };

  const sendOTP = async (otp: string, email: string, userEmail: string) => {
    try {
      const tokenRef = collection(db, 'users', userEmail, 'resetTokens'); 
      await setDoc(doc(tokenRef), {
        otp,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        attemptCount: 0,
      });

      const body = JSON.stringify({
        from: {
          email: VERIFIED_SENDER_EMAIL,
          name: 'DanhBa App',
        },
        to: [{ email }],
        subject: 'Mã OTP đặt lại mật khẩu - DanhBa App',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 10px; background-color: #f9f9f9;">
          <h2 style="color: #2c3e50;">🔐 Đặt lại mật khẩu</h2>
          <p>Xin chào,</p>
          <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản tại <strong>DanhBa App</strong>.</p>
          <p>Mã xác thực (OTP) của bạn là:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1abc9c;">${otp}</span>
          </div>
          <p>Mã OTP có hiệu lực trong vòng <strong>10 phút</strong>. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
          <hr style="margin: 30px 0;" />
          <p style="font-size: 12px; color: #7f8c8d;">© ${new Date().getFullYear()} DanhBa App. All rights reserved.</p>
        </div>
        `,
      });

      const response = await fetch('https://api.mailersend.com/v1/email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MAILERSEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!response.ok) {
        try {
          const errorData = responseText ? JSON.parse(responseText) : { message: 'No detailed error message' };
          throw new Error(`Gửi OTP thất bại. Status: ${response.status}, Error: ${JSON.stringify(errorData)}`);
        } catch (parseError) {
          throw new Error(`Gửi OTP thất bại. Status: ${response.status}, Error: Response không hợp lệ: ${responseText}`);
        }
      }

      const responseData = responseText ? JSON.parse(responseText) : {};
      console.log('OTP gửi thành công tới', email, 'Response:', responseData);
      Alert.alert('Thông báo', `OTP đã gửi tới ${email}. Kiểm tra hộp thư (bao gồm Spam/Junk).`);
    } catch (error: any) {
      console.error('Send OTP error:', error.message);
      Alert.alert('Lỗi', `Không thể gửi OTP tới ${email}. Lý do: ${error.message}. Kiểm tra console log.`);
      throw error;
    }
  };

  const handleRequestOTP = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Lỗi', 'Vui lòng nhập email hợp lệ.');
      return;
    }

    setIsLoading(true);
    try {
      const foundUserEmail = await checkEmailExists(email);
      if (!foundUserEmail) {
        Alert.alert('Lỗi', 'Email không tồn tại trong hệ thống.');
        return;
      }

      setUserEmail(foundUserEmail); // Lưu email thay vì name
      const otp = generateOTP();
      await sendOTP(otp, email, foundUserEmail);
      setStep(2);
    } catch (error: any) {
      console.error('Request OTP error:', error.message);
      Alert.alert('Lỗi', 'Không thể xử lý yêu cầu OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp.trim()) return Alert.alert('Lỗi', 'Nhập mã OTP');
    if (newPassword !== confirmNewPassword) return Alert.alert('Lỗi', 'Mật khẩu không khớp');
    if (!userEmail) return Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng');

    setIsLoading(true);
    try {
      const tokensRef = collection(db, 'users', userEmail, 'resetTokens'); // Sử dụng userEmail
      const querySnapshot = await getDocs(tokensRef);
      let validToken = null;
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        if (data.otp === otp && new Date(data.expiresAt) > new Date() && data.attemptCount < 5) {
          validToken = doc;
          break;
        }
      }

      if (!validToken) {
        Alert.alert('Lỗi', 'OTP không hợp lệ hoặc hết hạn');
        setIsLoading(false);
        return;
      }

      await setDoc(validToken.ref, { attemptCount: validToken.data().attemptCount + 1 }, { merge: true });

      const userRef = doc(db, 'users', userEmail); // Sử dụng userEmail
      await setDoc(userRef, { password: newPassword }, { merge: true });

      await deleteDoc(validToken.ref);

      Alert.alert('Thành công', 'Đặt lại mật khẩu thành công!');
      navigation.navigate('Login');
    } catch (error: any) {
      console.error('Reset password error:', error.message);
      Alert.alert('Lỗi', 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Quên mật khẩu</Text>
          {step === 1 ? (
            <>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập email đã đăng ký"
                  placeholderTextColor="#8a9ba5"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleRequestOTP}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>{isLoading ? 'Đang xử lý...' : 'Gửi mã OTP'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Mã OTP"
                  placeholderTextColor="#8a9ba5"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu mới"
                  placeholderTextColor="#8a9ba5"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
                <TextInput
                  style={styles.input}
                  placeholder="Xác nhận mật khẩu"
                  placeholderTextColor="#8a9ba5"
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry
                />
              </View>
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>{isLoading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={styles.backLink} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>
              Quay lại <Text style={styles.linkHighlight}>Đăng nhập</Text>
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
  buttonDisabled: { backgroundColor: '#a0a0a0' },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  backLink: { marginTop: 24, alignItems: 'center' },
  linkText: { fontSize: 16, color: '#5c6b73' },
  linkHighlight: { color: '#1c4550', fontWeight: '600' },
});