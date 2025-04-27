import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { signOut } from 'firebase/auth';
import { onValue, ref, remove, set } from 'firebase/database';
import { collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { AddCircle, Call, Setting3, Trash } from 'iconsax-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  LayoutChangeEvent,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Contact, Group, RootStackParamList } from '../../App';
import { auth, db, realtimeDb } from '../../firebase';
import { appColors } from '../constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactList'>;

export default function ContactListScreen({ navigation }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('https://i.pinimg.com/736x/bc/43/98/bc439871417621836a0eeea768d60944.jpg');
  const [contactAvatars, setContactAvatars] = useState<{ [key: string]: string }>({});
  const [itemHeight, setItemHeight] = useState<number>(70);
  const user = auth.currentUser;
  const currentSwipeableRef = useRef<Swipeable | null>(null);

  useEffect(() => {
    if (!user) return;

    console.log('UID người dùng hiện tại:', user.uid);

    // Tải danh sách nhóm từ Firestore (thời gian thực)
    const groupsRef = collection(db, 'users', user.uid, 'groups');
    const unsubscribeGroups = onSnapshot(
      groupsRef,
      (snapshot) => {
        const groupList: Group[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Group));
        setGroups(groupList);
        console.log('Groups loaded:', groupList);
      },
      (error) => {
        console.error('Error loading groups:', error);
        Alert.alert('Lỗi', 'Không thể tải danh sách nhóm.');
      }
    );

    // Tải danh sách liên hệ từ Firestore
    const contactsRef = collection(db, 'users', user.uid, 'contacts');
    const unsubscribeContacts = onSnapshot(
      contactsRef,
      (snapshot) => {
        const contactList: Contact[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Contact));
        const sortedContacts = contactList.sort((a, b) => a.name.localeCompare(b.name));
        setContacts(sortedContacts);
        setFilteredContacts(sortedContacts);

        // Log để kiểm tra groupId
        contactList.forEach(contact => {
          console.log(`Contact: ${contact.name}, groupId: ${contact.groupId || 'none'}`);
          const avatarRef = ref(realtimeDb, `contactAvatars/${contact.id}`);
          onValue(
            avatarRef,
            (snapshot) => {
              const data = snapshot.val();
              if (data && data.avatarBase64) {
                setContactAvatars(prev => ({
                  ...prev,
                  [contact.id]: `data:image/jpeg;base64,${data.avatarBase64}`,
                }));
              }
            },
            (error) => {
              console.log('Realtime Database onValue error:', error);
            }
          );
        });
      },
      (error) => {
        console.error('Firestore onSnapshot error:', error.code, error.message);
        Alert.alert('Lỗi', 'Không thể tải danh sách liên hệ. Vui lòng kiểm tra kết nối mạng.');
      }
    );

    const avatarRef = ref(realtimeDb, `avatars/${user.uid}`);
    const unsubscribeAvatar = onValue(
      avatarRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data && data.avatarBase64) {
          setAvatarUrl(`data:image/jpeg;base64,${data.avatarBase64}`);
        }
      },
      (error) => {
        console.error('Realtime Database avatar onValue error:', error);
        Alert.alert('Lỗi', 'Không thể tải ảnh đại diện.');
      }
    );

    return () => {
      unsubscribeGroups();
      unsubscribeContacts();
      unsubscribeAvatar();
    };
  }, [user]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const filtered = contacts.filter(
        contact =>
          contact.name.toLowerCase().includes(query.toLowerCase()) ||
          contact.phone.includes(query)
      );
      setFilteredContacts(filtered);
    }
  };

  const handleSaveContact = (contact?: Contact) => {
    navigation.navigate('AddEditContact', {
      contact,
      onSave: (updatedContact: Contact) => {
        setContacts(prev => {
          const updatedContacts = prev.filter(c => c.id !== updatedContact.id);
          return [...updatedContacts, updatedContact].sort((a, b) => a.name.localeCompare(b.name));
        });
        setFilteredContacts(prev => {
          const updatedFiltered = prev.filter(c => c.id !== updatedContact.id);
          return [...updatedFiltered, updatedContact].sort((a, b) => a.name.localeCompare(b.name));
        });
      },
    });
  };

  const handlePickImage = async () => {
    if (!user) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Lỗi', 'Bạn cần cấp quyền truy cập thư viện ảnh!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const base64 = result.assets[0].base64;

      if (base64) {
        try {
          const avatarRef = ref(realtimeDb, `avatars/${user.uid}`);
          await set(avatarRef, { avatarBase64: base64 });
          setAvatarUrl(`data:image/jpeg;base64,${base64}`);
        } catch (error) {
          console.error('Lỗi khi lưu ảnh Base64 vào Realtime Database:', error);
          Alert.alert('Lỗi', 'Không thể cập nhật ảnh đại diện. Kiểm tra quyền truy cập.');
        }
      }
    }
  };

  const handleSetting = () => {
    navigation.navigate('Setting');
  };

  const handleCall = async (contact: Contact) => {
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

  const handleDelete = async (contactId: string) => {
    if (!user) return;

    const contact = contacts.find(c => c.id === contactId);
    if (!contact) {
      Alert.alert('Lỗi', 'Không tìm thấy liên hệ.');
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
              const contactRef = doc(db, 'users', user.uid, 'contacts', contactId);
              await deleteDoc(contactRef);

              const avatarRef = ref(realtimeDb, `contactAvatars/${contactId}`);
              await remove(avatarRef);

              setContacts(prev => prev.filter(contact => contact.id !== contactId));
              setFilteredContacts(prev => prev.filter(contact => contact.id !== contactId));
              setContactAvatars(prev => {
                const updatedAvatars = { ...prev };
                delete updatedAvatars[contactId];
                return updatedAvatars;
              });

              Alert.alert('Thành công', 'Liên hệ đã được xóa.');
            } catch (error) {
              console.error('Lỗi khi xóa liên hệ:', error);
              Alert.alert('Lỗi', 'Không thể xóa liên hệ. Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  };

  const onItemLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setItemHeight(height);
  };

  const renderLeftActions = (contact: Contact, dragX: Animated.AnimatedInterpolation<number>) => {
    const translateX = dragX.interpolate({
      inputRange: [0, 50],
      outputRange: [-50, 0],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View
        style={[styles.actionContainer, { height: itemHeight, transform: [{ translateX }] }]}
      >
        <TouchableOpacity
          style={[styles.callAction, { height: 40, width: 40 }]}
          onPress={() => handleCall(contact)}
        >
          <Call size={24} color="#fff" variant="Bold" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderRightActions = (contactId: string, dragX: Animated.AnimatedInterpolation<number>) => {
    const translateX = dragX.interpolate({
      inputRange: [-50, 0],
      outputRange: [0, 50],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View
        style={[styles.actionContainer, { height: itemHeight, transform: [{ translateX }] }]}
      >
        <TouchableOpacity
          style={[styles.deleteAction, { height: 40, width: 40 }]}
          onPress={() => handleDelete(contactId)}
        >
          <Trash size={24} color="#fff" variant="Bold" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderItemContent = (item: Contact, swipeableRef: React.RefObject<Swipeable>) => {
    // Lấy color trực tiếp từ groups dựa trên groupId
    const groupColor = item.groupId ? groups.find(g => g.id === item.groupId)?.color : null;

    return (
      <TouchableOpacity
        activeOpacity={1}
        style={styles.contactItem}
        onLayout={onItemLayout}
        onPress={() => {
          if (currentSwipeableRef.current && currentSwipeableRef.current !== swipeableRef.current) {
            currentSwipeableRef.current.close();
          }
          navigation.navigate('ContactDetail', { contact: item });
        }}
      >
        {groupColor && (
          <View style={[styles.groupDot, { backgroundColor: groupColor }]} />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 50, height: 50 }}>
            <Image
              source={{ uri: contactAvatars[item.id] || 'https://i.pinimg.com/736x/bc/43/98/bc439871417621836a0eeea768d60944.jpg' }}
              defaultSource={{ uri: 'https://i.pinimg.com/736x/bc/43/98/bc439871417621836a0eeea768d60944.jpg' }}
              style={styles.avatarContact}
            />
          </View>
          <Text style={styles.contactName}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: Contact }) => {
    const swipeableRef = React.createRef<Swipeable>();

    return (
      <View style={styles.itemWrapper}>
        <View style={styles.backgroundLayer} />
        <Swipeable
          ref={swipeableRef}
          renderLeftActions={(progress, dragX) => renderLeftActions(item, dragX)}
          renderRightActions={(progress, dragX) => renderRightActions(item.id, dragX)}
          friction={2}
          overshootFriction={8}
          onSwipeableWillOpen={() => {
            if (currentSwipeableRef.current && currentSwipeableRef.current !== swipeableRef.current) {
              currentSwipeableRef.current.close();
            }
            currentSwipeableRef.current = swipeableRef.current;
          }}
        >
          {renderItemContent(item, swipeableRef)}
        </Swipeable>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: appColors.primary }}>
      <View style={{ flex: 1, backgroundColor: appColors.secondary }}>
        <View style={{ width: '100%', height: 1, position: 'absolute', backgroundColor: appColors.primary, top: 0, left: 0, right: 0 }} />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={handleSetting}>
              <Setting3 size={40} color={appColors.secondary} variant="Bulk" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerCenter}>
            <TouchableOpacity onPress={handlePickImage}>
              <Image source={{ uri: avatarUrl }} style={styles.avatarAdmin} />
            </TouchableOpacity>
            <Text style={styles.emailText}>{user?.email || 'Chưa đăng nhập'}</Text>
          </View>
          <View style={styles.headerBottom}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <TextInput
                placeholder="Tìm kiếm liên hệ"
                style={styles.searchContact}
                value={searchQuery}
                onChangeText={handleSearch}
              />
            </View>
          </View>
        </View>
        <View style={styles.container}>
          {filteredContacts.length === 0 ? (
            <Text style={styles.emptyText}>
              {searchQuery ? 'Không tìm thấy liên hệ' : 'Chưa có liên hệ nào'}
            </Text>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              initialNumToRender={10}
              windowSize={5}
              removeClippedSubviews={true}
            />
          )}
          <TouchableOpacity style={styles.addButton} onPress={() => handleSaveContact()}>
            <AddCircle size="50" color={appColors.primary} variant="Bulk" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomRightRadius: 48,
    borderBottomLeftRadius: 48,
    backgroundColor: appColors.primary,
    height: '35%',
    justifyContent: 'space-between',
  },
  headerTop: {
    marginRight: 16,
    marginTop: 8,
    alignItems: 'flex-end',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerBottom: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  searchContact: {
    width: '85%',
    height: 40,
    borderRadius: 20,
    backgroundColor: appColors.secondary,
    paddingHorizontal: 16,
  },
  avatarAdmin: {
    width: 80,
    height: 80,
    borderRadius: 50,
    padding: 3,
    borderWidth: 2,
    borderColor: appColors.primary2,
  },
  avatarContact: {
    width: 50,
    height: 50,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: appColors.secondary,
  },
  emailText: {
    marginTop: 8,
    color: appColors.secondary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  container: {
    paddingTop: 8,
    flex: 1,
    backgroundColor: appColors.secondary,
  },
  itemWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  backgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: appColors.primary,
    borderRadius: 16,
    zIndex: -1,
  },
  contactItem: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    marginHorizontal: 0,
    width: '100%',
    height: 70,
    justifyContent: 'center',
    zIndex: 1,
    borderRadius: 16,
  },
  contactName: {
    marginLeft: 16,
    fontSize: 18,
    color: appColors.primary,
  },
  addButton: {
    position: 'absolute',
    right: 15,
    bottom: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 50,
  },
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    backgroundColor: appColors.primary,
    zIndex: 0,
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
  callAction: {
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
  groupDot: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 2,
    borderWidth: 1,
    borderColor: '#fff',
  },
});