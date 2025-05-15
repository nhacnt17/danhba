import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { get, ref } from 'firebase/database';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { ArrowCircleLeft } from 'iconsax-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { Contact, RootStackParamList } from '../../App';
import { db, realtimeDb } from '../../firebase';
import { appColors } from '../constants/Colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BackupHistory'>;

interface BackupItem {
  code: string;
  createdAt: number;
  contactCount: number;
  options: string[];
}

const BackupHistoryScreen = ({ navigation }: Props) => {
  const [backupItems, setBackupItems] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null); 
  const qrRefs = useRef<{ [key: string]: View }>({});
  const animationValues = useRef<{ [key: string]: Animated.Value }>({}).current;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail'); 
        if (email) {
          setUserEmail(email);
          const loadBackupHistory = async () => {
            setIsLoading(true);
            try {
              const codesRef = collection(db, 'users', email, 'backupCodes'); 
              const q = query(codesRef, orderBy('createdAt', 'desc'));
              const snapshot = await getDocs(q);
              const items: BackupItem[] = [];

              for (const doc of snapshot.docs) {
                const { code, createdAt } = doc.data();
                const backupRef = ref(realtimeDb, `sharedContacts/${code}`);
                const backupSnapshot = await get(backupRef);

                if (backupSnapshot.exists()) {
                  const backupData = backupSnapshot.val();
                  const contacts: Contact[] = backupData.contacts || [];
                  const options: string[] = ['Tên', 'Số'];
                  if (contacts.some(contact => contact.avatarBase64)) {
                    options.push('Ảnh');
                  }
                  if (contacts.some(contact => contact.email)) {
                    options.push('Email');
                  }

                  items.push({
                    code,
                    createdAt,
                    contactCount: contacts.length,
                    options,
                  });

                  animationValues[code] = new Animated.Value(0);
                }
              }

              setBackupItems(items);
            } catch (error: any) {
              console.error('Lỗi khi tải lịch sử sao lưu:', error);
              Alert.alert('Lỗi', 'Không thể tải lịch sử sao lưu. Vui lòng thử lại.');
            } finally {
              setIsLoading(false);
            }
          };
          loadBackupHistory();
        } else {
          Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
          navigation.replace('Login');
        }
      } catch (error) {
        console.error('Error reading userEmail from AsyncStorage:', error);
        Alert.alert('Lỗi', 'Không thể tải thông tin người dùng.');
        navigation.replace('Login');
      }
    };
    initialize();
  }, [navigation, animationValues]);

  const handleDownloadQR = useCallback(async (code: string) => {
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
      console.log('Bắt đầu chụp ảnh QR:', code);

      let attempts = 0;
      const maxAttempts = 3;
      let uri: string | null = null;

      while (attempts < maxAttempts && !uri) {
        attempts++;
        console.log(`Thử lần ${attempts}: Kiểm tra qrRef...`);

        const qrView = qrRefs.current[code];
        if (!qrView) {
          console.warn('qrRef không tồn tại, thử lại sau 500ms');
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        try {
          uri = await captureRef(qrView, {
            format: 'png',
            quality: 1,
            width: 350,
            height: 430,
          });
          console.log('Ảnh chụp:', uri);
          break;
        } catch (error: any) {
          console.warn(`Lỗi chụp QR (thử ${attempts}/${maxAttempts}):`, error.message);
          if (attempts === maxAttempts) throw error;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!uri) {
        throw new Error('Không thể chụp mã QR sau nhiều lần thử');
      }

      const fileName = `QRCode_${code}_${Date.now()}.png`;
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
  }, [mediaPermission, requestMediaPermission]);

  const toggleExpand = (code: string) => {
    if (expandedItem === code) {
      Animated.timing(animationValues[code], {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => setExpandedItem(null));
    } else {
      if (expandedItem) {
        Animated.timing(animationValues[expandedItem], {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }
      setExpandedItem(code);
      Animated.timing(animationValues[code], {
        toValue: 460,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  const renderBackupItem = ({ item }: { item: BackupItem }) => {
    const date = new Date(item.createdAt);
    const formattedDate = date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const formattedDateTime = date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const handleCopy = async () => {
      await Clipboard.setStringAsync(item.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <View style={styles.itemWrapper}>
        <TouchableOpacity
          style={[
            styles.itemContainer,
            expandedItem === item.code && styles.itemContainerExpanded,
          ]}
          onPress={() => toggleExpand(item.code)}
        >
          <Text style={styles.itemText}>Ngày: {formattedDate}</Text>
        </TouchableOpacity>
        <Animated.View
          style={[styles.expandedView, { height: animationValues[item.code] }]}
        >
          <View
            style={styles.expandedContent}
            ref={ref => {
              if (ref) qrRefs.current[item.code] = ref;
            }}
          >
            <TouchableOpacity onPress={handleCopy}>
              <Text style={styles.expandedTitle}>Mã sao lưu: {item.code}</Text>
            </TouchableOpacity>
            <Text style={styles.expandedDate}>Ngày: {formattedDateTime}</Text>
            <View style={styles.expandedQrContainer}>
              <QRCode
                value={item.code}
                size={246}
                color={appColors.primary}
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text style={styles.expandedInstruction}>
              Quét mã này để khôi phục danh bạ
            </Text>
            <TouchableOpacity
              onPress={() => handleDownloadQR(item.code)}
              disabled={isLoading}
            >
              <Text style={styles.expandedButtonText}>Tải mã QR</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: appColors.secondary }}>
      <SafeAreaView style={{ backgroundColor: appColors.primary }}>
        <View style={styles.Header}>
          <View style={{ width: 50 }}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ArrowCircleLeft size="34" color="#FF8A65" variant="Bulk" />
            </TouchableOpacity>
          </View>
          <Text style={styles.tileHeader}>Lịch sử sao lưu</Text>
          <View style={{ width: 50 }} />
        </View>
      </SafeAreaView>

      <View style={styles.container}>
        {backupItems.length === 0 && !isLoading ? (
          <Text style={styles.emptyText}>Chưa có bản sao lưu nào</Text>
        ) : (
          <FlatList
            data={backupItems}
            renderItem={renderBackupItem}
            keyExtractor={item => item.code}
            contentContainerStyle={styles.listContainer}
          />
        )}

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={appColors.primary} />
          </View>
        )}
      </View>
      {copied && <View style={styles.containerToast}><Text style={styles.toast}>Đã sao chép mã!</Text></View>}
    </View>
  );
};

export default BackupHistoryScreen;

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
  container: {
    flex: 1,
    backgroundColor: appColors.secondary,
    padding: 16,
  },
  listContainer: {
    paddingBottom: 20,
  },
  itemWrapper: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemContainer: {
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  itemContainerExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  itemText: {
    fontSize: 16,
    color: appColors.primary,
  },
  expandedView: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  expandedContent: {
    width: 350,
    height: 420,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    padding: 20,
    shadowColor: '#000',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  expandedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: appColors.primary,
    marginBottom: 10,
  },
  expandedDate: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
  },
  expandedQrContainer: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: appColors.primary,
    borderRadius: 8,
    marginBottom: 20,
  },
  expandedInstruction: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  expandedButton: {
    backgroundColor: appColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  expandedButtonText: {
    color: appColors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 16,
    color: appColors.primary,
    textAlign: 'center',
    marginTop: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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