import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ref, set } from 'firebase/database';
import { addDoc, collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { Add, ArrowCircleLeft, Trash } from 'iconsax-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ActionSheet, { ActionSheetRef } from 'react-native-actions-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Contact, Group, RootStackParamList } from '../../App';
import { db, realtimeDb } from '../../firebase';
import { appColors } from '../constants/Colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditContact'>;

export default function AddEditContactScreen({ navigation, route }: Props) {
  const [name, setName] = useState(route.params?.contact?.name || '');
  const [phone, setPhone] = useState(route.params?.contact?.phone || '');
  const [email, setEmail] = useState(route.params?.contact?.email || '');
  const [avatarBase64, setAvatarBase64] = useState<string | null>(
    route.params?.contact?.avatarBase64 || null
  );
  const [groupId, setGroupId] = useState<string | null>(route.params?.contact?.groupId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#FF0000');
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null); 
  const actionSheetRef = useRef<ActionSheetRef>(null);

  const { contact } = route.params || {};
  const headerTitle = contact ? `Sửa liên hệ` : 'Thêm liên hệ';

  const colorList = [
    '#FF0000', // Đỏ
    '#00FF00', // Xanh lá
    '#0000FF', // Xanh dương
    '#FFFF00', // Vàng
    '#FF00FF', // Tím
    '#FFA500', // Cam
    '#FF69B4', // Hồng
    '#A52A2A', // Nâu
    '#808080', // Xám
    '#00FFFF', // Cyan
  ];

  // Lọc màu chưa được sử dụng
  const availableColors = colorList.filter(
    color => !groups.some(group => group.color === color)
  );

  // Lấy danh sách nhóm và tạo nhóm mặc định nếu cần
  useEffect(() => {
    const initialize = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail'); 
        if (email) {
          setUserEmail(email);
          const groupsRef = collection(db, 'users', email, 'groups'); 
          const snapshot = await getDocs(groupsRef);
          if (snapshot.empty) {
            // Tạo nhóm mặc định
            const defaultGroups = [
              { name: 'Gia đình', color: '#FF0000' },
              { name: 'Công việc', color: '#0000FF' },
              { name: 'Bạn bè', color: '#00FF00' },
            ];
            for (const group of defaultGroups) {
              await addDoc(groupsRef, group);
            }
          }
          // Lấy lại danh sách nhóm
          const groupList: Group[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as Group));
          setGroups(groupList);
        } else {
          Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
          navigation.replace('Login');
        }
      } catch (error) {
        console.error('Error initializing:', error);
        Alert.alert('Lỗi', 'Không thể tải thông tin người dùng hoặc danh sách nhóm.');
        navigation.replace('Login');
      }
    };
    initialize();
  }, [navigation]);

  const handlePickImage = async () => {
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
        setAvatarBase64(base64);
      }
    }
  };

  const handleSave = async () => {
    if (!name || !phone) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ tên và số điện thoại');
      return;
    }
    if (!userEmail) { 
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      navigation.replace('Login');
      return;
    }

    setIsLoading(true);

    const contactData: Contact = {
      id: route.params?.contact?.id || '',
      name,
      phone,
      email: email.trim() || undefined,
      avatarBase64: avatarBase64 || undefined,
      groupId: groupId || undefined,
    };

    try {
      const contactsRef = collection(db, 'users', userEmail, 'contacts'); 
      let contactId = contactData.id;

      if (contactData.id) {
        await setDoc(doc(contactsRef, contactData.id), {
          name,
          phone,
          email: email || null,
          avatarBase64: avatarBase64 || null,
          groupId: groupId || null,
        });
        console.log('Đã cập nhật liên hệ:', contactData);
      } else {
        const docRef = await addDoc(contactsRef, {
          name,
          phone,
          email: email || null,
          avatarBase64: avatarBase64 || null,
          groupId: groupId || null,
        });
        contactId = docRef.id;
        contactData.id = contactId;
        console.log('Đã thêm liên hệ mới:', contactData);
      }

      if (avatarBase64) {
        const avatarRef = ref(realtimeDb, `contactAvatars/${contactId}`);
        await set(avatarRef, { avatarBase64 });
      }

      route.params?.onSave?.(contactData);
      setIsLoading(false);
      navigation.goBack();
    } catch (error) {
      console.error('Lỗi khi lưu vào Firestore/Realtime Database:', error);
      setIsLoading(false);
      Alert.alert('Lỗi', 'Không thể lưu liên hệ. Kiểm tra kết nối hoặc quyền.');
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên nhóm');
      return;
    }
    if (!userEmail) { 
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      navigation.replace('Login');
      return;
    }

    try {
      const groupsRef = collection(db, 'users', userEmail, 'groups'); 
      const docRef = await addDoc(groupsRef, {
        name: newGroupName,
        color: newGroupColor,
      });
      const newGroup = { id: docRef.id, name: newGroupName, color: newGroupColor };
      setGroups(prev => [...prev, newGroup]);
      setGroupId(docRef.id); 
      setNewGroupName('');
      setNewGroupColor(availableColors[0] || '#FF0000');
      setShowAddGroupModal(false);
      console.log('Group added and selected:', newGroup);
    } catch (error) {
      console.error('Error adding group:', error);
      Alert.alert('Lỗi', 'Không thể tạo nhóm.');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!userEmail) { 
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      navigation.replace('Login');
      return;
    }

    Keyboard.dismiss();
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc muốn xóa nhóm này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const groupRef = doc(db, 'users', userEmail, 'groups', groupId); 
              await deleteDoc(groupRef);
              setGroups(prev => prev.filter(group => group.id !== groupId));
              if (groupId === groupId) {
                setGroupId(null);
              }
              console.log('Group deleted:', groupId);
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Lỗi', 'Không thể xóa nhóm.');
            }
          },
        },
      ]
    );
  };

  const showGroupActionSheet = () => {
    console.log('showGroupActionSheet called, groups:', groups);
    Keyboard.dismiss();
    actionSheetRef.current?.show();
  };

  const renderGroupItem = ({ item }: { item: Group }) => (
    <View style={styles.groupItem}>
      <TouchableOpacity
        style={styles.groupContent}
        onPress={() => {
          console.log('Selected group:', item.name);
          setGroupId(item.id);
          actionSheetRef.current?.hide();
        }}
      >
        <View style={[styles.groupColorDot, { backgroundColor: item.color }]} />
        <Text style={styles.groupName}>{item.name}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          console.log('Delete group:', item.name);
          handleDeleteGroup(item.id);
        }}
      >
        <Trash size={24} color="#FF0000" variant="Bold" />
      </TouchableOpacity>
    </View>
  );

  const renderColorOption = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.colorOption, { backgroundColor: item }]}
      onPress={() => {
        console.log('Selected color:', item);
        setNewGroupColor(item);
      }}
    >
      {newGroupColor === item && <Text style={styles.colorSelected}>✔</Text>}
    </TouchableOpacity>
  );

  // Debug state
  // console.log('showAddGroupModal:', showAddGroupModal, 'showColorPicker:', showColorPicker);

  return (
    <View style={{ flex: 1, backgroundColor: appColors.secondary }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: appColors.primary }}>
        <View style={styles.Header}>
          <View style={{ width: 70 }}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ArrowCircleLeft size="34" color="#FF8A65" variant="Bulk" />
            </TouchableOpacity>
          </View>
          <Text style={styles.tileHeader}>{headerTitle}</Text>
          <View style={{ width: 70 }}>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveButtonText}>Xong</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
          <Image
            source={{
              uri: avatarBase64
                ? `data:image/jpeg;base64,${avatarBase64}`
                : 'https://i.pinimg.com/736x/bc/43/98/bc439871417621836a0eeea768d60944.jpg',
            }}
            style={styles.avatar}
          />
          <Text style={styles.avatarText}>Chọn ảnh</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Tên"
          value={name}
          onChangeText={setName}
          autoFocus
          keyboardAppearance="light"
        />
        <TextInput
          style={styles.input}
          placeholder="Điện thoại"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          keyboardAppearance="light"
        />
        <TextInput
          style={styles.input}
          placeholder="Email (tùy chọn)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          keyboardAppearance="light"
        />
        <TouchableOpacity
          style={[styles.groupButton, { zIndex: 1 }]}
          onPress={() => {
            console.log('Group button pressed');
            showGroupActionSheet();
          }}
        >
          <Text style={styles.groupButtonText}>
            {groupId
              ? groups.find(g => g.id === groupId)?.name || 'Chọn nhóm'
              : 'Chọn nhóm'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal thêm nhóm */}
      <Modal
        visible={showAddGroupModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          console.log('Closing add group modal');
          setShowAddGroupModal(false);
          setNewGroupName('');
          setNewGroupColor(availableColors[0] || '#FF0000');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addGroupModal}>
            <Text style={styles.modalTitle}>Thêm nhóm mới</Text>
            <TextInput
              style={styles.addGroupInput}
              placeholder="Tên nhóm"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
              keyboardAppearance="light"
            />
            <FlatList
              data={availableColors}
              keyExtractor={item => item}
              renderItem={renderColorOption}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorList}
              ListEmptyComponent={<Text>Không còn màu nào khả dụng</Text>}
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={styles.okButton} onPress={handleAddGroup}>
                <Text style={styles.okButtonText}>OK</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  console.log('Cancel adding group');
                  setShowAddGroupModal(false);
                  setNewGroupName('');
                  setNewGroupColor(availableColors[0] || '#FF0000');
                }}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal chọn màu (giữ nguyên cho các chức năng khác nếu cần) */}
      <Modal
        visible={showColorPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          console.log('Closing color picker');
          setShowColorPicker(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.colorPickerModal}>
            <Text style={styles.modalTitle}>Chọn màu</Text>
            {colorList.length === 0 ? (
              <Text>Không có màu nào</Text>
            ) : (
              <FlatList
                data={colorList}
                keyExtractor={item => item}
                renderItem={renderColorOption}
                numColumns={4}
                columnWrapperStyle={styles.colorGrid}
                ListEmptyComponent={<Text>Không có màu nào</Text>}
              />
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                console.log('Closing color picker via cancel');
                setShowColorPicker(false);
              }}
            >
              <Text style={styles.closeButtonText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Action Sheet chọn nhóm */}
      <ActionSheet ref={actionSheetRef} containerStyle={styles.actionSheetContainer}>
        <View style={styles.actionSheetContent}>
          <View style={styles.actionSheetHeader}>
            <Text style={styles.modalTitle}>Chọn nhóm</Text>
            <TouchableOpacity
              onPress={() => {
                console.log('Opening add group modal');
                actionSheetRef.current?.hide();
                setTimeout(() => setShowAddGroupModal(true), 300); 
              }}
            >
              <Add size={24} color="#007AFF" variant="Bold" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={groups}
            keyExtractor={item => item.id}
            renderItem={renderGroupItem}
            ListEmptyComponent={<Text>Chưa có nhóm nào</Text>}
            style={styles.groupList}
            keyboardShouldPersistTaps="handled"
          />
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              console.log('Action sheet closed');
              actionSheetRef.current?.hide();
            }}
          >
            <Text style={styles.closeButtonText}>Hủy</Text>
          </TouchableOpacity>
        </View>
      </ActionSheet>

      {isLoading && (
        <Modal transparent={true} animationType="none" visible={isLoading}>
          <View style={styles.overlay}>
            <View style={styles.overlayIn}>
              <ActivityIndicator size="small" color={appColors.secondary} />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.secondary,
  },
  inputContainer: {
    marginTop: 20,
    marginHorizontal: 15,
    backgroundColor: appColors.secondary,
    borderRadius: 10,
    overflow: 'hidden',
  },
  avatarContainer: {
    alignItems: 'center',
    padding: 15,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  avatarText: {
    marginTop: 5,
    color: '#007AFF',
    fontSize: 16,
  },
  input: {
    padding: 15,
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  groupButton: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 1,
  },
  groupButtonText: {
    fontSize: 18,
    color: '#007AFF',
  },
  saveButton: {
    position: 'absolute',
    top: 10,
    right: 15,
  },
  saveButtonText: {
    textAlign: 'right',
    fontSize: 18,
    color: appColors.primary2,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayIn: {
    width: 80,
    height: 80,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  addGroupModal: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  addGroupInput: {
    width: '100%',
    padding: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 5,
    marginBottom: 10,
  },
  colorList: {
    paddingVertical: 5,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  colorSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  okButton: {
    flex: 1,
    padding: 10,
    backgroundColor: appColors.primary,
    borderRadius: 5,
    alignItems: 'center',
    marginRight: 5,
  },
  okButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  cancelButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: appColors.primary,
    borderRadius: 5,
    alignItems: 'center',
    marginLeft: 5,
  },
  cancelButtonText: {
    color: appColors.primary,
    fontSize: 16,
  },
  closeButton: {
    marginTop: 10,
    padding: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  actionSheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  actionSheetContent: {
    padding: 20,
    maxHeight: 400,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupList: {
    maxHeight: 300,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  groupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  groupName: {
    fontSize: 16,
  },
  colorPickerModal: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  colorGrid: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
});