import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { onValue, ref } from 'firebase/database';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { ArrowCircleLeft, Call, Message, Sms } from 'iconsax-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Contact, Group, RootStackParamList } from '../../App';
import { db, realtimeDb } from '../../firebase';
import { appColors } from '../constants/Colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactDetail'>;

export default function ContactDetailScreen({ navigation, route }: Props) {
  const { contact, group: initialGroup } = route.params;
  const [avatarUrl, setAvatarUrl] = useState<string>(
    'https://i.pinimg.com/736x/bc/43/98/bc439871417621836a0eeea768d60944.jpg'
  );
  const [group, setGroup] = useState<Group | null>(initialGroup || null);
  const [isLoadingGroup, setIsLoadingGroup] = useState<boolean>(!initialGroup && !!contact.groupId);
  const [userEmail, setUserEmail] = useState<string | null>(null); 

  useEffect(() => {
    // Lấy userEmail từ AsyncStorage
    const initialize = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail'); 
        if (email) {
          setUserEmail(email);
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

    // Lấy ảnh đại diện từ Realtime Database
    const avatarRef = ref(realtimeDb, `contactAvatars/${contact.id}`);
    const unsubscribe = onValue(
      avatarRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data && data.avatarBase64) {
          setAvatarUrl(`data:image/jpeg;base64,${data.avatarBase64}`);
        } else if (contact.avatarBase64) {
          setAvatarUrl(`data:image/jpeg;base64,${contact.avatarBase64}`);
        }
      },
      // (error) => {
      //   console.error('Realtime Database onValue error:', error);
      // }
    );

    // Lấy thông tin nhóm từ Firestore nếu không có initialGroup
    const fetchGroup = async () => {
      if (!initialGroup && contact.groupId && userEmail) { 
        try {
          setIsLoadingGroup(true);
          const groupRef = doc(db, 'users', userEmail, 'groups', contact.groupId); 
          const groupSnap = await getDoc(groupRef);
          if (groupSnap.exists()) {
            const groupData = { id: groupSnap.id, ...groupSnap.data() } as Group;
            setGroup(groupData);
            console.log('Group loaded from Firestore:', groupData);
          } else {
            console.log('Group not found for groupId:', contact.groupId);
          }
        } catch (error) {
          console.error('Error fetching group:', error);
        } finally {
          setIsLoadingGroup(false);
        }
      }
    };

    if (userEmail) { 
      fetchGroup();
    }

    return () => unsubscribe();
  }, [contact.id, contact.avatarBase64, contact.groupId, initialGroup, userEmail]);

  const handleEdit = () => {
    navigation.navigate('AddEditContact', {
      contact,
      onSave: (updatedContact: Contact) => {
        navigation.setParams({ contact: updatedContact });
        navigation.goBack();
      },
    });
  };

  const handleDelete = () => {
    if (!userEmail) { 
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      navigation.replace('Login');
      return;
    }

    Alert.alert(
      'Xác nhận',
      `Bạn có chắc muốn xóa liên hệ "${contact.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', userEmail, 'contacts', contact.id)); 
              console.log('Đã xóa liên hệ:', contact.id);
              Alert.alert('Thành công', 'Liên hệ đã được xóa.');
              navigation.goBack();
            } catch (error: any) {
              // console.error('Lỗi khi xóa liên hệ:', error);
              // Alert.alert('Lỗi', 'Không thể xóa liên hệ. Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  };

  const handleCall = async () => {
    const phoneNumber = contact.phone.replace(/\D/g, '');
    const url = `tel:${phoneNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        console.log('Mở cuộc gọi:', phoneNumber);
      } else {
        Alert.alert('Lỗi', 'Thiết bị không hỗ trợ gọi điện.');
      }
    } catch (error: any) {
      console.error('Lỗi khi gọi điện:', error);
      Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi. Vui lòng thử lại.');
    }
  };

  const handleMessage = async () => {
    const phoneNumber = contact.phone.replace(/\D/g, '');
    const url = `sms:${phoneNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        console.log('Mở nhắn tin:', phoneNumber);
      } else {
        Alert.alert('Lỗi', 'Thiết bị không hỗ trợ nhắn tin.');
      }
    } catch (error: any) {
      console.error('Lỗi khi nhắn tin:', error);
      Alert.alert('Lỗi', 'Không thể mở ứng dụng nhắn tin. Vui lòng thử lại.');
    }
  };

  const handleEmail = async () => {
    if (!contact.email) {
      Alert.alert('Lỗi', 'Liên hệ này chưa có email.');
      return;
    }
    const url = `mailto:${contact.email}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        console.log('Mở gửi email:', contact.email);
      } else {
        Alert.alert('Lỗi', 'Thiết bị không hỗ trợ gửi email.');
      }
    } catch (error: any) {
      console.error('Lỗi khi gửi email:', error);
      Alert.alert('Lỗi', 'Không thể mở ứng dụng email. Vui lòng thử lại.');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: appColors.primary }}>
      <View style={styles.container}>
        <View style={styles.Header}>
          <View style={{ width: 70 }}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ArrowCircleLeft size="34" color="#FF8A65" variant="Bulk" />
            </TouchableOpacity>
          </View>
          <Text style={styles.tileHeader}>Liên hệ</Text>
          <View style={{ width: 70 }}>
            <TouchableOpacity onPress={handleEdit}>
              <Text style={styles.editButtonText}>Sửa</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.infoContainer}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          </View>
          <Text style={styles.name}>{contact.name}</Text>
          <View style={styles.actionContainer}>
            <TouchableOpacity onPress={handleCall} style={{ alignItems: 'center' }}>
              <Call size="32" color={appColors.primary} variant="Bold" />
              <Text style={styles.actionText}>Gọi điện</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleMessage} style={{ alignItems: 'center' }}>
              <Message size="32" color={appColors.primary} variant="Bold" />
              <Text style={styles.actionText}>Nhắn tin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleEmail}
              style={{ alignItems: 'center' }}
              disabled={!contact.email}
            >
              <Sms size="32" color={contact.email ? appColors.primary : '#888'} variant="Bold" />
              <Text
                style={[
                  styles.actionText,
                  { color: contact.email ? appColors.primary : '#888' },
                ]}
              >
                Gửi mail
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.label}>Điện thoại</Text>
            <Text style={styles.value}>{contact.phone}</Text>
          </View>
          {contact.email && (
            <View style={styles.detailItem}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{contact.email}</Text>
            </View>
          )}
          {group && !isLoadingGroup && (
            <View style={styles.detailItem}>
              <Text style={styles.label}>Nhóm</Text>
              <View style={styles.groupContent}>
                <View style={[styles.groupColorDot, { backgroundColor: group.color }]} />
                <Text style={styles.value}>{group.name}</Text>
              </View>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteText}>Xóa liên hệ</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.secondary,
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
  infoContainer: {
    marginTop: 20,
    marginHorizontal: 15,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  name: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 36,
    textAlign: 'center',
  },
  detailItem: {
    width: '100%',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  label: {
    fontSize: 16,
    color: '#888',
  },
  value: {
    fontSize: 18,
    color: '#000',
  },
  groupContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  actionContainer: {
    marginTop: 8,
    marginBottom: 16,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    color: appColors.primary,
  },
  editButtonText: {
    textAlign: 'right',
    fontSize: 18,
    color: appColors.primary2,
    fontWeight: '600',
  },
  deleteButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  deleteText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
  },
});