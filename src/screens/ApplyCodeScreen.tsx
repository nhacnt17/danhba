import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { get, ref, set } from 'firebase/database';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { TextalignLeft } from 'iconsax-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Contact, DrawerParamList, RootStackParamList } from '../../App';
import { db, realtimeDb } from '../../firebase';
import { appColors } from '../constants/Colors';

import { DrawerScreenProps } from '@react-navigation/drawer';
import { CommonActions, NavigationProp } from '@react-navigation/native';

// Combine DrawerScreenProps with a NavigationProp for RootStackParamList
type Props = DrawerScreenProps<DrawerParamList, 'ApplyCode'> & {
  navigation: NavigationProp<RootStackParamList>;
};

const ApplyCodeScreen = ({ navigation }: Props) => {
  const [inputCode, setInputCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(true); // Mặc định hiển thị quét mã QR
  const [hasScanned, setHasScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const isProcessingScan = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail');
        if (email) {
          setUserEmail(email);
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

    if (showScanner) {
      setHasScanned(false);
      isProcessingScan.current = false;
    }
  }, [navigation, showScanner]);

  const handleApplyCode = async (code: string) => {
    if (!userEmail) {
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      setIsLoading(false);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
      return;
    }

    if (!code) {
      Alert.alert('Lỗi', 'Mã không hợp lệ');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const backupRef = ref(realtimeDb, `sharedContacts/${code}`);
      const snapshot = await get(backupRef);

      if (!snapshot.exists()) {
        Alert.alert('Lỗi', 'Mã không hợp lệ hoặc không tồn tại');
        setIsLoading(false);
        setShowScanner(false);
        setHasScanned(false);
        return;
      }

      const backupData = snapshot.val();
      const sharedContacts: Contact[] = backupData.contacts;
      const includeAvatar = sharedContacts.some(contact => contact.avatarBase64);
      const includeEmail = sharedContacts.some(contact => contact.email);

      const contactsRef = collection(db, 'users', userEmail, 'contacts');
      const currentSnapshot = await getDocs(contactsRef);
      const currentContacts: Contact[] = currentSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        phone: doc.data().phone,
        email: doc.data().email || undefined,
        avatarBase64: doc.data().avatarBase64 || undefined,
      } as Contact));

      let addedCount = 0;
      let skippedCount = 0;

      // Lọc trùng lặp trước khi thêm
      const uniqueSharedContacts = Array.from(
        new Map(
          sharedContacts.map(contact => [
            `${contact.name.toLowerCase()}_${contact.phone}_${contact.email || ''}`,
            contact,
          ])
        ).values()
      );

      for (const contact of uniqueSharedContacts) {
        const isDuplicate = currentContacts.some(
          existing =>
            existing.name.toLowerCase() === contact.name.toLowerCase() &&
            existing.phone === contact.phone &&
            (existing.email || '') === (contact.email || '')
        );

        if (!isDuplicate) {
          const docRef = await addDoc(contactsRef, {
            name: contact.name,
            phone: contact.phone,
            email: contact.email || null,
            avatarBase64: contact.avatarBase64 || null,
          });
          if (contact.avatarBase64) {
            const avatarRef = ref(realtimeDb, `contactAvatars/${docRef.id}`);
            await set(avatarRef, { avatarBase64: contact.avatarBase64 });
          }
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      let message = `Đã thêm ${addedCount} liên hệ`;
      if (addedCount > 0) {
        message += ` (bao gồm tên, số${includeAvatar ? ', ảnh' : ''}${includeAvatar && includeEmail ? ', ' : ''}${includeEmail ? 'email' : ''}).`;
      } else {
        message += '.';
      }
      if (skippedCount > 0) {
        message += ` ${skippedCount} liên hệ bị bỏ qua do trùng lặp.`;
      }
      Alert.alert('Thành công', message);
      setInputCode('');
      setShowScanner(true); // Quay lại quét mã QR sau khi áp dụng thành công
      setHasScanned(true);
    } catch (error: any) {
      console.error('Lỗi khi áp dụng mã:', error);
      Alert.alert('Lỗi', 'Không thể áp dụng mã. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanQR = () => {
    if (Platform.OS === 'web') {
      Alert.alert('Lỗi', 'Quét mã QR không hỗ trợ trên trình duyệt web');
      return;
    }

    if (!permission) {
      console.log('Yêu cầu quyền camera');
      requestPermission();
      return;
    }

    if (!permission.granted) {
      Alert.alert(
        'Lỗi',
        'Cần cấp quyền camera để quét mã QR',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Cấp quyền', onPress: () => requestPermission() },
        ]
      );
      return;
    }

    setShowScanner(true);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (hasScanned || isProcessingScan.current) {
      return;
    }

    isProcessingScan.current = true;
    console.log('Đã quét mã QR:', data); // Log để debug
    setHasScanned(true);
    setShowScanner(true); // Giữ giao diện quét
    console.log('Đóng máy quét sau khi quét');
    setInputCode(data);
    handleApplyCode(data);
  };

  const handleManualInput = () => {
    if (isLoading || isProcessingScan.current) {
      return; // Không cho phép chuyển sang nhập mã thủ công khi đang xử lý
    }
    setShowScanner(false); // Chuyển sang giao diện nhập mã thủ công
    setHasScanned(false);
    setInputCode(''); // Xóa mã cũ khi chuyển sang nhập thủ công
  };

  const handleCloseScanner = () => {
    setShowScanner(false);
    setHasScanned(false);
    isProcessingScan.current = false;
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: appColors.primary }}>
        <View style={styles.Header}>
          <View style={{ width: 50 }}>
            <TouchableOpacity onPress={() => navigation.openDrawer()}>
              <TextalignLeft size="24" color="#FF8A65" variant="Bulk" />
            </TouchableOpacity>
          </View>
          <Text style={styles.tileHeader}>Áp dụng mã chia sẻ</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.container}>
          {showScanner ? (
            <View style={styles.scannerContainer}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                enableTorch={false}
              />
              <TouchableOpacity
                style={styles.manualButton}
                onPress={handleManualInput}
                disabled={isLoading || isProcessingScan.current}
              >
                <Text style={styles.manualButtonText}>Nhập mã</Text>
              </TouchableOpacity>
            </View>
          ) : (
            !isLoading && ( // Chỉ hiển thị container nhập mã khi không loading
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Nhập mã thủ công</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mã chia sẻ"
                  value={inputCode}
                  onChangeText={setInputCode}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => handleApplyCode(inputCode)}
                  disabled={isLoading}
                >
                  <Text style={styles.buttonText}>Áp dụng mã</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleScanQR} disabled={isLoading}>
                  <Text style={styles.buttonText}>Quét mã QR</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={appColors.primary} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

export default ApplyCodeScreen;

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
  input: {
    borderWidth: 1,
    borderColor: appColors.primary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  scannerContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: appColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  closeButtonText: {
    color: appColors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: appColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  manualButtonText: {
    color: appColors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});