import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { get, ref, set } from 'firebase/database';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { ArrowCircleLeft } from 'iconsax-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Contact, RootStackParamList } from '../../App';
import { auth, db, realtimeDb } from '../../firebase';
import { appColors } from '../constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'ApplyCode'>;

const ApplyCodeScreen = ({ navigation }: Props) => {
  const [inputCode, setInputCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const user = auth.currentUser;
  const isProcessingScan = useRef(false);

  useEffect(() => {
    if (showScanner) {
      setHasScanned(false);
      isProcessingScan.current = false;
    }
  }, [showScanner]);

  const handleApplyCode = async (code: string) => {
    if (!user) {
      Alert.alert('Lỗi', 'Bạn cần đăng nhập để áp dụng mã');
      setIsLoading(false);
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

      const contactsRef = collection(db, 'users', user.uid, 'contacts');
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

      for (const contact of sharedContacts) {
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
        message += ` (bao gồm tên, số${includeAvatar ? ', ảnh' : ''}${
          includeAvatar && includeEmail ? ', ' : ''
        }${includeEmail ? 'email' : ''}).`;
      } else {
        message += '.';
      }
      if (skippedCount > 0) {
        message += ` ${skippedCount} liên hệ bị bỏ qua do trùng lặp.`;
      }
      Alert.alert('Thành công', message);
      setInputCode('');
      setShowScanner(false);
      setHasScanned(true);
    } catch (error: any) {
      console.error('Lỗi khi áp dụng mã: ', error);
      Alert.alert('Lỗi', 'Không thể áp dụng mã. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
      setShowScanner(false);
      setHasScanned(false);
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
      console.log('Bỏ qua quét:', data);
      return;
    }

    isProcessingScan.current = true;
    console.log('Đã quét mã QR:', data);
    setHasScanned(true);
    setShowScanner(false);
    console.log('Đóng máy quét sau khi quét');
    setInputCode(data);
    handleApplyCode(data);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: appColors.primary }}>
      <View style={styles.Header}>
        <View style={{ width: 50 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowCircleLeft size="34" color="#FF8A65" variant="Bulk" />
          </TouchableOpacity>
        </View>
        <Text style={styles.tileHeader}>Áp dụng mã chia sẻ</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nhập hoặc quét mã</Text>
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

        {showScanner && (
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
              style={styles.closeButton}
              onPress={() => {
                setShowScanner(false);
                setHasScanned(false);
                isProcessingScan.current = false;
              }}
            >
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={appColors.primary} />
          </View>
        )}
      </View>
    </SafeAreaView>
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
  },
  closeButton: {
    position: 'absolute',
    bottom: 20,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});