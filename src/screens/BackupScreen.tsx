import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { ref, set } from 'firebase/database';
import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { ArrowCircleLeft, Refresh, TextalignLeft } from 'iconsax-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { Contact, DrawerParamList, RootStackParamList } from '../../App';
import { db, realtimeDb } from '../../firebase';
import { appColors } from '../constants/Colors';
import { CommonActions, NavigationProp } from '@react-navigation/native'; // Add this import for NavigationProp
import { DrawerScreenProps } from '@react-navigation/drawer';

// Combine DrawerScreenProps with a NavigationProp for RootStackParamList
type Props = DrawerScreenProps<DrawerParamList, 'Backup'> & {
  navigation: NavigationProp<RootStackParamList>;
};


const BackupScreen = ({ navigation }: Props) => {
  const [shareCode, setShareCode] = useState('');
  const [latestBackupTime, setLatestBackupTime] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [includeAvatar, setIncludeAvatar] = useState(false);
  const [includeEmail, setIncludeEmail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const qrViewRef = useRef<View>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail');
        if (email) {
          setUserEmail(email);
          const loadLatestCode = async () => {
            try {
              const codesRef = collection(db, 'users', email, 'backupCodes');
              const q = query(codesRef, orderBy('createdAt', 'desc'), limit(1));
              const snapshot = await getDocs(q);
              if (!snapshot.empty) {
                const latestBackup = snapshot.docs[0].data();
                setShareCode(latestBackup.code);
                const date = new Date(latestBackup.createdAt);
                setLatestBackupTime(
                  date.toLocaleString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                );
              }
            } catch (error: any) {
              console.error('Lỗi khi tải mã sao lưu:', error);
            }
          };
          loadLatestCode();
        } else {
          Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            })
          );
        }
      } catch (error) {
        console.error('Error reading userEmail from AsyncStorage:', error);
        Alert.alert('Lỗi', 'Không thể tải thông tin người dùng.');
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          })
        );
      }
    };
    initialize();
  }, [navigation]);

  const generateRandomCode = () => {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  const performBackup = async () => {
    setShowModal(false);
    if (!userEmail) {
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      ); return;
    }

    setIsLoading(true);

    try {
      const contactsRef = collection(db, 'users', userEmail, 'contacts');
      const snapshot = await getDocs(contactsRef);
      const contacts: Contact[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          phone: data.phone,
          ...(includeAvatar && data.avatarBase64 && { avatarBase64: data.avatarBase64 }),
          ...(includeEmail && data.email && { email: data.email }),
        } as Contact;
      });

      if (contacts.length === 0) {
        Alert.alert('Thông báo', 'Bạn chưa có liên hệ nào để sao lưu');
        setIsLoading(false);
        return;
      }

      const code = generateRandomCode();
      const createdAt = Date.now();
      const backupData = {
        userId: userEmail,
        contacts,
        createdAt,
      };

      const backupRef = ref(realtimeDb, `sharedContacts/${code}`);
      await set(backupRef, backupData);

      const codesRef = collection(db, 'users', userEmail, 'backupCodes');
      await addDoc(codesRef, {
        code,
        createdAt,
      });

      setShareCode(code);
      const date = new Date(createdAt);
      setLatestBackupTime(
        date.toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      Alert.alert('Thành công', `Mã sao lưu của bạn: ${code}. Mã QR đã được tạo để chia sẻ.`);
    } catch (error: any) {
      console.error('Lỗi khi sao lưu dữ liệu:', error);
      Alert.alert('Lỗi', 'Không thể sao lưu dữ liệu. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackup = () => {
    setShowModal(true);
  };

  const handleDownloadQR = async () => {
    if (!shareCode) {
      Alert.alert('Lỗi', 'Chưa có mã QR để tải xuống');
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert('Lỗi', 'Tải mã QR không hỗ trợ trên trình duyệt web');
      return;
    }

    if (!mediaPermission?.granted) {
      console.log('Yêu cầu quyền MediaLibrary');
      const permissionResponse = await requestMediaPermission();
      if (!permissionResponse.granted) {
        Alert.alert('Lỗi', 'Cần cấp quyền để lưu mã QR vào thư viện ảnh');
        return;
      }
    }

    try {
      setIsLoading(true);
      console.log('Bắt đầu chụp ảnh QR');

      if (!qrViewRef.current) {
        console.error('qrViewRef không tồn tại');
        throw new Error('Không tìm thấy tham chiếu view QR');
      }

      const uri = await captureRef(qrViewRef, {
        format: 'png',
        quality: 1,
        width: 400,
        height: 500,
      });
      console.log('Ảnh chụp:', uri);

      const fileName = `QRCode_${shareCode}_${Date.now()}.png`;
      const cacheUri = `${FileSystem.cacheDirectory}${fileName}`;
      console.log('Lưu file tạm:', cacheUri);

      await FileSystem.copyAsync({ from: uri, to: cacheUri });

      console.log('Lưu vào MediaLibrary');
      const asset = await MediaLibrary.createAssetAsync(cacheUri);
      console.log('Lưu ảnh thành công:', fileName);
      Alert.alert('Thành công', `Mã QR đã được lưu vào thư viện ảnh với tên ${fileName}`);

      await FileSystem.deleteAsync(cacheUri, { idempotent: true });
    } catch (error: any) {
      console.error('Lỗi khi tải mã QR:', error);
      Alert.alert('Lỗi', `Không thể tải mã QR: ${error.message || 'Vui lòng thử lại.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: appColors.secondary }}>
      <SafeAreaView style={{ backgroundColor: appColors.primary }}>
        <View style={styles.Header}>
          <View style={{ width: 50 }}>
            <TouchableOpacity onPress={() => navigation.openDrawer()}>
              <TextalignLeft size="24" color="#FF8A65" variant="Bulk" />
            </TouchableOpacity>
          </View>
          <Text style={styles.tileHeader}>Sao lưu danh bạ</Text>
          <View style={{ width: 50 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.sectionTitle}>Tạo bản sao lưu</Text>
              <TouchableOpacity style={{ flexDirection: 'row' }} onPress={() => navigation.navigate('BackupHistory')}>
                <Refresh size="22" color="#FF8A65" variant="Bold" />
                <Text style={{ color: appColors.primary2, fontSize: 18, marginLeft: 5, fontWeight: '600' }}>
                  Lịch sử
                </Text>
              </TouchableOpacity>
            </View>
            {latestBackupTime ? (
              <Text style={styles.backupTime}>
                Sao lưu gần nhất: {latestBackupTime}
              </Text>
            ) : null}
            <TouchableOpacity style={styles.button} onPress={handleBackup} disabled={isLoading}>
              <Text style={styles.buttonText}>Sao lưu dữ liệu</Text>
            </TouchableOpacity>
            {shareCode ? (
              <View style={styles.qrContainer}>
                <View ref={qrViewRef} style={styles.qrWrapper}>
                  <TouchableOpacity onPress={handleCopy}>
                    <Text style={styles.qrTitle}>Mã sao lưu: {shareCode}</Text>
                  </TouchableOpacity>
                  <Text style={styles.qrDate}>Ngày: {latestBackupTime || 'N/A'}</Text>
                  <View style={styles.qrCodeContainer}>
                    <QRCode
                      value={shareCode}
                      size={250}
                      color={appColors.primary}
                      backgroundColor="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.qrInstruction}>Quét mã này để khôi phục danh bạ</Text>
                </View>
                <TouchableOpacity onPress={handleDownloadQR} disabled={isLoading}>
                  <Text style={styles.buttonDownloading}>Tải mã QR</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={appColors.primary} />
            </View>
          )}

          <Modal
            visible={showModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Tùy chọn sao lưu</Text>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>Chỉ tên và số</Text>
                  <Switch
                    value={true}
                    disabled={true}
                    trackColor={{ false: '#767577', true: appColors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>Lưu ảnh liên hệ</Text>
                  <Switch
                    value={includeAvatar}
                    onValueChange={setIncludeAvatar}
                    trackColor={{ false: '#767577', true: appColors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>Lưu email liên hệ</Text>
                  <Switch
                    value={includeEmail}
                    onValueChange={setIncludeEmail}
                    trackColor={{ false: '#767577', true: appColors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.okButton]}
                    onPress={performBackup}
                  >
                    <Text style={styles.modalButtonText}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>
      {copied && <View style={styles.containerToast}><Text style={styles.toast}>Đã sao chép mã!</Text></View>}
    </View>
  );
};

export default BackupScreen;

const styles = StyleSheet.create({
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
  buttonDownloading: {
    color: appColors.primary,
    fontSize: 18,
    fontWeight: 'bold',
    padding: 12,
    marginTop: 10,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: appColors.secondary,
  },
  container: {
    flex: 1,
    backgroundColor: appColors.secondary,
    padding: 16,
    alignItems: 'center',
  },
  section: {
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: appColors.primary,
    marginBottom: 10,
  },
  backupTime: {
    fontSize: 16,
    color: appColors.primary,
    marginBottom: 10,
  },
  button: {
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
  qrContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  qrWrapper: {
    width: '100%',
    height: 430,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: appColors.primary,
    marginBottom: 10,
  },
  qrDate: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
  },
  qrCodeContainer: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: appColors.primary,
    borderRadius: 8,
    marginBottom: 20,
  },
  qrInstruction: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: appColors.primary,
    marginBottom: 20,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  switchLabel: {
    fontSize: 16,
    color: appColors.primary,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  okButton: {
    backgroundColor: appColors.primary,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  containerToast: {
    position: 'absolute',
    bottom: 40,
    left: '10%',
    right: '10%',
  },
  toast: {
    alignSelf: 'center',
    backgroundColor: appColors.primary,
    color: appColors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    opacity: 0.8,
  },
});